import { describe, expect, it } from "vitest";
import { getOpenAIEndpoint, resolveProviderOrder } from "./model";

describe("model provider routing", () => {
  it("keeps Cloudflare as the default provider", () => {
    expect(resolveProviderOrder({})).toEqual(["cloudflare"]);
  });

  it("uses an explicitly configured fallback after the primary", () => {
    expect(resolveProviderOrder({
      MODEL_PROVIDER: "cloudflare",
      FALLBACK_MODEL_PROVIDER: "openai-compatible",
    })).toEqual(["cloudflare", "openai-compatible"]);
  });

  it("does not duplicate the same provider as a fallback", () => {
    expect(resolveProviderOrder({
      MODEL_PROVIDER: "cloudflare",
      FALLBACK_MODEL_PROVIDER: "cloudflare",
    })).toEqual(["cloudflare"]);
  });

  it("builds the OpenAI-compatible endpoint from a /v1 base URL", () => {
    expect(getOpenAIEndpoint("https://api.example.com/v1/"))
      .toBe("https://api.example.com/v1/chat/completions");
  });

  it("adds /v1 when the base URL omits it", () => {
    expect(getOpenAIEndpoint("https://api.example.com"))
      .toBe("https://api.example.com/v1/chat/completions");
  });

  it("rejects non-HTTPS or credential-bearing base URLs", () => {
    expect(() => getOpenAIEndpoint("http://localhost:3000")).toThrow();
    expect(() => getOpenAIEndpoint("https://user:pass@example.com/v1")).toThrow();
  });
});
