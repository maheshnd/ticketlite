// PKCE helpers: the verifier must be long and random, the challenge its SHA-256 (RFC 7636, method S256).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { challengeFor, createState, createVerifier } from "../src/services/pkce";

describe("pkce", () => {
  it("creates a 43-character URL-safe verifier, different every time", () => {
    const verifier = createVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createVerifier()).not.toBe(verifier);
  });

  it("derives the challenge as BASE64URL(SHA256(verifier))", () => {
    const verifier = createVerifier();
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challengeFor(verifier)).toBe(expected);
    expect(challengeFor(verifier)).not.toContain("="); // base64url has no padding
  });

  it("creates a random state", () => {
    expect(createState()).not.toBe(createState());
  });
});
