# TA2LK public research tools

The research API is protected by the same Cloudflare Access JWT validation used by chat and memory.

## Endpoint

POST /api/research

Example web search:

{
  "provider": "web",
  "query": "Cloudflare Workers agent tools documentation",
  "limit": 5
}

Example global GitHub repository search:

{
  "provider": "github",
  "kind": "repositories",
  "query": "open source AI agent skills",
  "limit": 5
}

GitHub kinds:
- repositories: unauthenticated public repository search through GitHub REST.
- skills: public GitHub-indexed discovery for SKILL.md and Agent Skills.
- code: native GitHub code search when GITHUB_TOKEN is configured; otherwise public web-index search restricted to github.com.

The chat endpoint also invokes research automatically when the latest user message explicitly asks to search, research, or find GitHub skills/repositories. Retrieved results are supplied as untrusted evidence, not instructions.

## GitHub code search limitation

GitHub's native REST code-search endpoint requires authentication. Public repository search does not. Without GITHUB_TOKEN, TA2LK falls back to public web-index results for GitHub code and skill discovery. To enable native code search, configure GITHUB_TOKEN as a Cloudflare Worker secret in the relevant environment; never place it in source code or browser JavaScript.

## Current boundaries

- Search is read-only. It does not clone or execute third-party repositories.
- Search results are capped at 10 per request and source responses are size/time limited.
- Skill discovery does not mean automatic installation. A candidate must be inspected, licensed, pinned to a revision, and reviewed before activation.
- No arbitrary shell execution, repository writes, merge, or production deployment is exposed by this phase.
- The DuckDuckGo HTML search endpoint is a public provider integration and may change markup, rate-limit requests, or temporarily become unavailable. Provider errors are returned instead of fabricated results.

## Foundational skills

- skills/web-research/SKILL.md
- skills/github-research/SKILL.md
- skills/skill-intake/SKILL.md

These follow the open Agent Skills SKILL.md convention and are project guidance files. Runtime skill discovery, approval, persistence, and activation are subsequent work.
