# LEX AI Gateway — setup

This branch adds a provider router to the existing Cloudflare Workers chat app.

## What is active

- `GET /api/health`: health and provider availability.
- `GET /api/providers`: lists configured providers.
- `POST /api/chat`: streams a chat response.
- Automatic fallback order defaults to Groq → Gemini → Cloudflare Workers AI.
- Cloudflare Workers AI remains available without a third-party API key.

## Configure optional providers

From the repository root, authenticate Wrangler and add provider keys as encrypted Worker secrets:

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
```

Only add a key for a provider you intend to use. Do not put API keys in source files, GitHub commits, frontend JavaScript, or public repository variables.

Optional model/routing settings can be added to Worker environment variables in the Cloudflare dashboard:

- `AI_PROVIDER_ORDER=groq,gemini,cloudflare`
- `GROQ_MODEL=openai/gpt-oss-120b`
- `GEMINI_MODEL=gemini-2.5-flash`
- `CF_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8`

Provider model IDs and account eligibility can change. Verify the exact model is enabled in the provider console before selecting it. If a provider is not configured or returns an error, the router tries the next configured provider.

## Deploy

```bash
npm install
npm run cf-typegen
npm run check
npm run deploy
```

The existing `wrangler.jsonc` already binds Workers AI as `AI` and static assets as `ASSETS`.

## Test

After deployment, open:

- `https://YOUR-WORKER.workers.dev/api/health`
- `https://YOUR-WORKER.workers.dev/api/providers`

Test chat with:

```bash
curl -N -X POST "https://YOUR-WORKER.workers.dev/api/chat" \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"اكتب ملخصاً عن الذكاء الاصطناعي"}]}'
```

## Cost and privacy notes

- Cloudflare Workers AI currently includes 10,000 Neurons per day on the Free plan; usage beyond the allocation requires a paid plan. Some models require paid access.
- Gemini's free tier has model-specific quotas and terms; Google states that free-tier content may be used to improve its products. Do not send confidential customer data through that tier.
- Groq limits vary by model and account; inspect the live Limits page in the Groq console.
- Free quotas are not unlimited and can change. This design prevents accidental fallback to a paid provider unless you explicitly configure its key and account.
- GitHub stores the code; the Worker executes the app. GitHub Actions is not the AI inference host.

## Next engineering phases

1. Add D1-backed conversation and user memory.
2. Add user authentication and per-user rate limits before public launch.
3. Add document upload, retrieval, and citations.
4. Add optional web search tools with explicit source links.
5. Add a model-evaluation layer that can ask a second model to critique an answer.
