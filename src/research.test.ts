import { describe, expect, it } from "vitest";
import { parseDuckDuckGoResults } from "./research";

describe("public web search result parsing", () => {
  it("extracts public result titles, URLs, and snippets", () => {
    const html = [
      '<a class="result__a" href="https://example.com/docs">Example &amp; Docs</a>',
      '<a class="result__snippet">Official documentation for the API.</a>',
      '<a class="result__a" href="https://github.com/example/project">Example Project</a>',
      '<a class="result__snippet">Open source implementation.</a>',
    ].join("");
    const results = parseDuckDuckGoResults(html, 5);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Example & Docs");
    expect(results[0].url).toBe("https://example.com/docs");
    expect(results[1].source).toBe("github.com");
  });

  it("unwraps DuckDuckGo redirect URLs and respects the result limit", () => {
    const html = [
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fpage">Example</a>',
      '<a class="result__a" href="https://example.net/second">Second</a>',
    ].join("");
    const results = parseDuckDuckGoResults(html, 1);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://example.org/page");
  });

  it("ignores malformed and provider-internal links", () => {
    const html = [
      '<a class="result__a" href="javascript:alert(1)">Unsafe</a>',
      '<a class="result__a" href="https://duckduckgo.com/about">Provider</a>',
    ].join("");
    expect(parseDuckDuckGoResults(html, 5)).toHaveLength(0);
  });
});
