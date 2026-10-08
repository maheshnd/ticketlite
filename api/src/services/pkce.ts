// PKCE (Proof Key for Code Exchange) helpers for the authorization code flow. Pure functions, easy to test.
// The verifier is a random secret kept on the server; Cognito only ever sees its SHA-256 hash (the
// challenge) until the final token exchange. CONCEPT: oauth-pkce
import { createHash, randomBytes } from "node:crypto";

// 32 random bytes -> 43 URL-safe characters (RFC 7636 allows 43-128).
export const createVerifier = () => randomBytes(32).toString("base64url");

// The "S256" method: BASE64URL(SHA256(verifier)).
export const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

// The `state` value ties the callback to the browser that started the login (CSRF protection for OAuth).
export const createState = () => randomBytes(16).toString("base64url");
