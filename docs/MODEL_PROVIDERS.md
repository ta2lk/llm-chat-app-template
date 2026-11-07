# TA2LK AI — Model Providers

## Default behavior
- The primary provider remains **Cloudflare Workers AI**.
- The default model is `@cf/meta/llama-3.1-8b-instruct-fp8`.
- No external or paid provider is enabled unless its configuration is added by the account owner.
- The chat endpoint streams provider output to the existing browser client. Both Workers AI chunks and OpenAI-compatible `choices[0].delta.content` chunks are supported by the client.

## Optional OpenAI-compatible provider
Configure these Worker settings only if you have chosen a compatible provider:
- `MODEL_PROVIDER=openai-compatible` to make it primary.
- `OPENAI_BASE_URL` as an HTTPS API base URL (for example, a provider URL ending in `/v1`).
- `OPENAI_MODEL` as the provider's model identifier.
- `OPENAI_API_KEY` as a Cloudflare Worker secret. Never commit it or send it to the browser.

The implementation calls the configured base URL's `/v1/chat/completions` endpoint (or `/chat/completions` when the base URL already ends in `/v1`) and requests streaming output.

## Optional fallback
Set `FALLBACK_MODEL_PROVIDER` to `cloudflare` or `openai-compatible` to try a second provider if the primary fails before streaming begins. The fallback is never silently enabled. Both providers must be configured and reachable. If the primary provider has already started streaming, a mid-stream failure cannot transparently switch providers.

## Cost and quota
This routing layer does not create free or unlimited model usage. Each provider has its own quotas, rate limits, and possible charges. Cloudflare remains the default until the account owner explicitly changes the Worker settings. Keep provider credentials in Worker secrets and review the provider's current pricing and usage dashboard.

## Validation
Unit tests cover provider order, fallback selection, endpoint construction, and HTTPS URL validation. CI type-checks and dry-runs the Worker. Live provider calls require configured credentials and are not simulated as successful by these tests.
