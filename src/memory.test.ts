import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import type { Env } from "./types";

type MemoryRow = {
  id: string;
  owner_id: string;
  category: string;
  fact: string;
  confidence: number;
  created_at: string;
  updated_at: string;
};

function base64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("protected D1 memory API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves, retrieves, isolates, and deletes memory for the authenticated owner", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const jwk = { ...publicJwk, kid: "ta2lk-test-key", alg: "RS256", use: "sig" };
    const teamDomain = "ta2lk-test.cloudflareaccess.com";
    const issuer = `https://${teamDomain}`;
    const audience = "ta2lk-test-audience";

    const makeToken = async (sub: string) => {
      const encode = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
      const header = encode({ alg: "RS256", typ: "JWT", kid: "ta2lk-test-key" });
      const payload = encode({
        sub,
        iss: issuer,
        aud: [audience],
        exp: Math.floor(Date.now() / 1000) + 600,
        nbf: Math.floor(Date.now() / 1000) - 10,
      });
      const signingInput = `${header}.${payload}`;
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode(signingInput),
      );
      return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
    };

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === `${issuer}/cdn-cgi/access/certs`) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }));

    const rows: MemoryRow[] = [];
    const DB = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            if (sql.startsWith("INSERT INTO memory_facts")) {
              return {
                run: async () => {
                  rows.push({
                    id: String(values[0]),
                    owner_id: String(values[1]),
                    category: String(values[2]),
                    fact: String(values[3]),
                    confidence: Number(values[4]),
                    created_at: "2026-11-07T00:00:00.000Z",
                    updated_at: "2026-11-07T00:00:00.000Z",
                  });
                  return { meta: { changes: 1 } };
                },
              };
            }
            if (sql.startsWith("SELECT id, category, fact")) {
              return {
                all: async () => ({
                  results: rows.filter((row) => row.owner_id === String(values[0])),
                }),
              };
            }
            if (sql.startsWith("DELETE FROM memory_facts")) {
              return {
                run: async () => {
                  const before = rows.length;
                  for (let index = rows.length - 1; index >= 0; index--) {
                    if (rows[index].id === String(values[0]) && rows[index].owner_id === String(values[1])) {
                      rows.splice(index, 1);
                    }
                  }
                  return { meta: { changes: before - rows.length } };
                },
              };
            }
            throw new Error(`Unexpected SQL in test: ${sql}`);
          },
        };
      },
    } as unknown as D1Database;

    const env = {
      DB,
      ACCESS_TEAM_DOMAIN: teamDomain,
      ACCESS_AUD: audience,
      AI: {} as Ai,
      ASSETS: { fetch: async () => new Response("assets") },
    } as Env;

    const ownerToken = await makeToken("owner-1");
    const saveResponse = await worker.fetch(
      new Request("https://ta2lk.test/api/memory", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Cf-Access-Jwt-Assertion": ownerToken,
        },
        body: JSON.stringify({ category: "preference", fact: "Prefers concise Arabic answers" }),
      }),
      env,
      {} as ExecutionContext,
    );
    expect(saveResponse.status).toBe(201);
    const saved = await saveResponse.json() as { saved: boolean; id: string };
    expect(saved.saved).toBe(true);

    const readResponse = await worker.fetch(
      new Request("https://ta2lk.test/api/memory", {
        headers: { "Cf-Access-Jwt-Assertion": ownerToken },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(readResponse.status).toBe(200);
    const read = await readResponse.json() as { memories: MemoryRow[] };
    expect(read.memories).toHaveLength(1);
    expect(read.memories[0].fact).toBe("Prefers concise Arabic answers");

    const otherOwnerToken = await makeToken("owner-2");
    const isolatedResponse = await worker.fetch(
      new Request("https://ta2lk.test/api/memory", {
        headers: { "Cf-Access-Jwt-Assertion": otherOwnerToken },
      }),
      env,
      {} as ExecutionContext,
    );
    const isolated = await isolatedResponse.json() as { memories: MemoryRow[] };
    expect(isolated.memories).toHaveLength(0);

    const deleteResponse = await worker.fetch(
      new Request(`https://ta2lk.test/api/memory?id=${saved.id}`, {
        method: "DELETE",
        headers: { "Cf-Access-Jwt-Assertion": ownerToken },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(deleteResponse.status).toBe(200);
    expect((await deleteResponse.json() as { deleted: boolean }).deleted).toBe(true);
  });
});
