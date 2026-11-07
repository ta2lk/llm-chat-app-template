import { Env, ChatMessage } from "./types";

export const DEFAULT_CLOUDFLARE_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
export type ModelProviderName = "cloudflare" | "openai-compatible";

type ModelConfig = Pick<
  Env,
  | "AI"
  | "MODEL_PROVIDER"
  | "FALLBACK_MODEL_PROVIDER"
  | "OPENAI_BASE_URL"
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL"
>;

export interface ModelRunResult {
  stream: ReadableStream<Uint8Array>;
  provider: ModelProviderName;
  model: string;
}

/** Resolve a configured primary and optional fallback without silently enabling paid services. */
export function resolveProviderOrder(env: Pick<ModelConfig, "MODEL_PROVIDER" | "FALLBACK_MODEL_PROVIDER">): ModelProviderName[] {
  const primary = env.MODEL_PROVIDER ?? "cloudflare";
  const fallback = env.FALLBACK_MODEL_PROVIDER;
  if (primary !== "cloudflare" && primary !== "openai-compatible") {
    throw new Error("Unsupported model provider");
  }
  if (!fallback || fallback === primary) return [primary];
  if (fallback !== "cloudflare" && fallback !== "openai-compatible") {
    throw new Error("Unsupported fallback model provider");
  }
  return [primary, fallback];
}

export function getOpenAIEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("OpenAI-compatible base URL must be a clean HTTPS URL");
  }
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = basePath.endsWith("/v1")
    ? `${basePath}/chat/completions`
    : `${basePath}/v1/chat/completions`;
  return url.toString();
}

function isOpenAIConfigured(env: ModelConfig): boolean {
  return Boolean(env.OPENAI_BASE_URL && env.OPENAI_API_KEY && env.OPENAI_MODEL);
}

async function runCloudflare(env: ModelConfig, messages: ChatMessage[]): Promise<ModelRunResult> {
  const inputs = {
    messages,
    max_tokens: 1024,
    stream: true,
  } satisfies AiTextGenerationInput & { stream: true };
  const stream = await env.AI.run<typeof DEFAULT_CLOUDFLARE_MODEL_ID>(
    DEFAULT_CLOUDFLARE_MODEL_ID,
    inputs,
  );
  return {
    stream: stream as ReadableStream<Uint8Array>,
    provider: "cloudflare",
    model: DEFAULT_CLOUDFLARE_MODEL_ID,
  };
}

async function runOpenAICompatible(env: ModelConfig, messages: ChatMessage[]): Promise<ModelRunResult> {
  if (!isOpenAIConfigured(env)) {
    throw new Error("OpenAI-compatible provider is not configured");
  }
  const endpoint = getOpenAIEndpoint(env.OPENAI_BASE_URL as string);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages,
      max_tokens: 1024,
      stream: true,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    // Do not include provider response bodies: they may contain sensitive diagnostics.
    throw new Error(`OpenAI-compatible provider returned HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("OpenAI-compatible provider returned an empty stream");
  return {
    stream: response.body,
    provider: "openai-compatible",
    model: env.OPENAI_MODEL as string,
  };
}

/**
 * Runs the configured provider order. Fallback is attempted only when explicitly configured;
 * credentials and provider errors never reach the browser.
 */
export async function runChatModel(env: ModelConfig, messages: ChatMessage[]): Promise<ModelRunResult> {
  const providers = resolveProviderOrder(env);
  let lastError: unknown;
  for (const provider of providers) {
    try {
      if (provider === "cloudflare") return await runCloudflare(env, messages);
      return await runOpenAICompatible(env, messages);
    } catch (error) {
      lastError = error;
      console.error(`TA2LK model provider failed: ${provider}`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All configured model providers failed");
}
