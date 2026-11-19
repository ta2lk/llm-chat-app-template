/**
 * LEX AI multi-provider gateway.
 * Cloudflare Workers AI is the zero-key fallback.
 * Gemini and Groq are optional OpenAI-compatible providers.
 */
import { Env, ChatMessage } from "./types";

const SYSTEM_PROMPT =
  "You are LEX, a precise Arabic-first AI assistant. Answer directly, distinguish facts from estimates, and never invent sources. Use the user's language unless asked otherwise.";

const DEFAULT_CF_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

type Provider = "groq" | "gemini" | "cloudflare";

type ChatBody = {
  messages?: ChatMessage[];
  provider?: Provider | "auto";
  model?: string;
  max_tokens?: number;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "LEX AI Gateway",
        providers: providerStatus(env),
      });
    }

    if (url.pathname === "/api/providers" && request.method === "GET") {
      return json({ providers: providerStatus(env) });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return handleChatRequest(request, env);
    }

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

function providerStatus(env: Env) {
  return [
    { id: "cloudflare", available: true, configured: true },
    { id: "gemini", available: Boolean(env.GEMINI_API_KEY), configured: Boolean(env.GEMINI_API_KEY) },
    { id: "groq", available: Boolean(env.GROQ_API_KEY), configured: Boolean(env.GROQ_API_KEY) },
  ];
}

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as ChatBody;
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    if (incoming.length === 0 || incoming.length > 30) {
      return json({ error: "messages must contain between 1 and 30 items" }, 400);
    }

    const messages: ChatMessage[] = incoming
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return json({ error: "The last message must be a user message" }, 400);
    }

    const promptMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const requested = body.provider ?? "auto";
    const order = providerOrder(env, requested);
    const errors: string[] = [];

    for (const provider of order) {
      try {
        if (provider === "groq" && env.GROQ_API_KEY) {
          const response = await openAICompatibleChat({
            url: "https://api.groq.com/openai/v1/chat/completions",
            key: env.GROQ_API_KEY,
            model: body.model || env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
            messages: promptMessages,
            maxTokens: boundedTokens(body.max_tokens),
          });
          if (response.ok) return withProviderHeader(response, "groq");
          errors.push("groq: " + await safeError(response));
          continue;
        }

        if (provider === "gemini" && env.GEMINI_API_KEY) {
          const response = await openAICompatibleChat({
            url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            key: env.GEMINI_API_KEY,
            model: body.model || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
            messages: promptMessages,
            maxTokens: boundedTokens(body.max_tokens),
          });
          if (response.ok) return withProviderHeader(response, "gemini");
          errors.push("gemini: " + await safeError(response));
          continue;
        }

        if (provider === "cloudflare") {
          const model = env.CF_MODEL || DEFAULT_CF_MODEL;
          const stream = await env.AI.run(model, {
            messages: promptMessages,
            max_tokens: boundedTokens(body.max_tokens),
            stream: true,
          }, {});
          return new Response(stream as ReadableStream, {
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              "x-lex-provider": "cloudflare",
            },
          });
        }
      } catch (error) {
        errors.push(provider + ": " + (error instanceof Error ? error.message : "provider error"));
      }
    }

    return json({
      error: "All configured AI providers failed.",
      details: errors.slice(0, 3),
    }, 503);
  } catch (error) {
    console.error("LEX AI request error:", error);
    return json({ error: "Invalid request or internal error" }, 400);
  }
}

function providerOrder(env: Env, requested: string): Provider[] {
  const allowed: Provider[] = ["groq", "gemini", "cloudflare"];
  if (requested !== "auto" && allowed.includes(requested as Provider)) {
    return [requested as Provider, ...allowed.filter((p) => p !== requested)];
  }
  const configured = (env.AI_PROVIDER_ORDER || "groq,gemini,cloudflare")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is Provider => allowed.includes(p as Provider));
  return [...configured, ...allowed.filter((p) => !configured.includes(p))];
}

async function openAICompatibleChat(args: {
  url: string;
  key: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<Response> {
  return fetch(args.url, {
    method: "POST",
    headers: {
      authorization: "Bearer " + args.key,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      max_tokens: args.maxTokens,
      stream: true,
    }),
  });
}

function withProviderHeader(response: Response, provider: Provider): Response {
  const headers = new Headers(response.headers);
  headers.set("x-lex-provider", provider);
  headers.set("cache-control", "no-cache, no-transform");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function boundedTokens(value?: number): number {
  if (!Number.isFinite(value)) return 1536;
  return Math.max(128, Math.min(4096, Math.floor(value as number)));
}

async function safeError(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500) || ("HTTP " + response.status);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
