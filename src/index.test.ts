import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "./index";

describe("decodeBase64Url", () => {
  it("decodes ordinary base64url text", () => {
    expect(new TextDecoder().decode(decodeBase64Url("SGVsbG8"))).toBe("Hello");
  });

  it("accepts URL-safe characters and restores missing padding", () => {
    expect(decodeBase64Url("-_8")).toEqual(Uint8Array.of(0xfb, 0xff));
  });

  it("decodes an empty payload", () => {
    expect(decodeBase64Url("")).toEqual(new Uint8Array());
  });
});
