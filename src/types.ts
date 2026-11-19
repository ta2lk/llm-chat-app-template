/**
 * Runtime bindings and provider configuration for LEX AI.
 */
export interface Env {
  AI: Ai;
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  // Store API keys as Cloudflare Worker secrets; never commit them.
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;

  // Optional non-secret routing configuration.
  GEMINI_MODEL?: string;
  GROQ_MODEL?: string;
  CF_MODEL?: string;
  AI_PROVIDER_ORDER?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
