/**
 * Public research tools for TA2LK. Provider hosts are fixed; input is query text only.
 */
import type { Env } from "./types";

type SearchResult = { title: string; url: string; snippet: string; source: string };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

function unwrapDuckDuckGoUrl(raw: string): string {
  try {
    const url = new URL(raw, "https://html.duckduckgo.com");
    if (url.hostname.endsWith("duckduckgo.com")) {
      const target = url.searchParams.get("uddg");
      if (target) return target;
    }
    return url.toString();
  } catch { return ""; }
}

export function parseDuckDuckGoResults(html: string, limit: number): SearchResult[] {
  const anchors = [...html.matchAll(/<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const snippets = [...html.matchAll(/<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const results: SearchResult[] = [];
  for (let i = 0; i < anchors.length && results.length < limit; i++) {
    const url = unwrapDuckDuckGoUrl(anchors[i][1]);
    if (!/^https?:\/\//i.test(url)) continue;
    let hostname = "";
    try { hostname = new URL(url).hostname; } catch { continue; }
    if (hostname === "html.duckduckgo.com" || hostname.endsWith(".duckduckgo.com")) continue;
    const title = cleanText(anchors[i][2]);
    if (!title) continue;
    results.push({ title, url, snippet: cleanText(snippets[i]?.[1] ?? ""), source: hostname });
  }
  return results;
}

async function searchWeb(query: string, limit: number): Promise<SearchResult[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const response = await fetch(url.toString(), {
    headers: { "user-agent": "TA2LK-Research/1.0", "accept": "text/html" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Web search provider returned HTTP " + response.status);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error("Search response exceeded size limit");
  return parseDuckDuckGoResults(html, limit);
}

async function searchGitHub(query: string, kind: string, limit: number, env: Env): Promise<{ results: SearchResult[]; note?: string }> {
  if (kind === "repositories") {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", String(limit));
    const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "TA2LK-Research" };
    if (env.GITHUB_TOKEN) headers.authorization = "Bearer " + env.GITHUB_TOKEN;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("GitHub repository search returned HTTP " + response.status);
    const payload = await response.json() as { items?: Array<{ full_name?: string; html_url?: string; description?: string; stargazers_count?: number; language?: string }> };
    return { results: (payload.items ?? []).map((item) => ({
      title: item.full_name ?? "GitHub repository", url: item.html_url ?? "",
      snippet: [item.description ?? "", item.language ? "Language: " + item.language : "", typeof item.stargazers_count === "number" ? "Stars: " + item.stargazers_count : ""].filter(Boolean).join(" · "),
      source: "github.com",
    })).filter((item) => item.url) };
  }

  if (kind === "code" && env.GITHUB_TOKEN) {
    const url = new URL("https://api.github.com/search/code");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", String(limit));
    const response = await fetch(url, {
      headers: { accept: "application/vnd.github+json", authorization: "Bearer " + env.GITHUB_TOKEN, "user-agent": "TA2LK-Research" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("GitHub code search returned HTTP " + response.status);
    const payload = await response.json() as { items?: Array<{ name?: string; path?: string; html_url?: string; repository?: { full_name?: string } }> };
    return { results: (payload.items ?? []).map((item) => ({
      title: [item.repository?.full_name, item.path ?? item.name].filter(Boolean).join(" / "),
      url: item.html_url ?? "", snippet: "GitHub code search result", source: "github.com",
    })).filter((item) => item.url) };
  }

  const searchQuery = kind === "skills" ? 'site:github.com ("SKILL.md" OR "agent skills") ' + query : "site:github.com " + query;
  return {
    results: await searchWeb(searchQuery, limit),
    note: kind === "code"
      ? "GitHub's native code-search API requires authentication. These are public web-index results; configure a server-side GitHub token to enable native code search."
      : "Skill discovery uses public GitHub-indexed pages. Review every candidate before adopting it.",
  };
}

export async function handleResearchRequest(request: Request, env: Env, identity: { sub?: string } | null): Promise<Response> {
  if (!identity?.sub) return json({ error: "Authentication required" }, 401);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawLength = Number(request.headers.get("content-length") ?? "0");
  if (rawLength > 8_000) return json({ error: "Request too large" }, 413);
  let body: { query?: unknown; provider?: unknown; kind?: unknown; limit?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "Invalid JSON body" }, 400); }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const provider = body.provider === "github" ? "github" : "web";
  const kind = typeof body.kind === "string" ? body.kind : "repositories";
  const limit = typeof body.limit === "number" && Number.isInteger(body.limit) ? Math.min(10, Math.max(1, body.limit)) : 5;
  if (!query || query.length > 500) return json({ error: "query must contain 1–500 characters" }, 400);
  if (provider === "github" && !["repositories", "code", "skills"].includes(kind)) {
    return json({ error: "kind must be repositories, code, or skills" }, 400);
  }
  try {
    if (provider === "github") {
      const result = await searchGitHub(query, kind, limit, env);
      return json({ provider, kind, query, results: result.results, note: result.note ?? null });
    }
    return json({ provider, query, results: await searchWeb(query, limit) });
  } catch (error) {
    console.error("Research request failed:", error);
    return json({ error: error instanceof Error ? error.message : "Research provider failed" }, 502);
  }
}
