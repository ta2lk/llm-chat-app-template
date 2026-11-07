/**
 * Type definitions for the LLM chat application.
 */
export interface Env {
	/** Cloudflare Workers AI binding. */
	AI: Ai;
	/** Static asset binding. */
	ASSETS: { fetch: (request: Request) => Promise<Response> };
	/** Optional D1 binding. Configure after creating the database in Cloudflare. */
	DB?: D1Database;
	/** Cloudflare Access team domain, e.g. example.cloudflareaccess.com. */
	ACCESS_TEAM_DOMAIN?: string;
	/** Application AUD value from the Cloudflare Access self-hosted application. */
	ACCESS_AUD?: string;
	/** Optional GitHub token for authenticated global code search; store as a Worker secret. */
	GITHUB_TOKEN?: string;
	/** Primary chat provider; defaults to Cloudflare Workers AI. */
	MODEL_PROVIDER?: "cloudflare" | "openai-compatible";
	/** Optional explicit fallback provider. No paid provider is enabled by default. */
	FALLBACK_MODEL_PROVIDER?: "cloudflare" | "openai-compatible";
	/** OpenAI-compatible API base URL (HTTPS only), configured as a Worker variable. */
	OPENAI_BASE_URL?: string;
	/** OpenAI-compatible API key; configure as a Worker secret, never in source. */
	OPENAI_API_KEY?: string;
	/** OpenAI-compatible model identifier. */
	OPENAI_MODEL?: string;
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
