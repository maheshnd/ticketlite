// Verifies Cognito ACCESS tokens inside the API (signature, expiry, issuer, client id, token_use).
//
// Why verify here when API Gateway's JWT authorizer already did? Defense in depth: the Lambda trusts
// nothing about the caller, and locally there is no API Gateway at all. It is cheap: Cognito's public
// keys (JWKS) are downloaded once per Lambda copy and cached in memory. CONCEPT: jwt, defense-in-depth
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { config } from "../config";

export type AccessTokenClaims = { sub: string; groups: string[] };

// Created on first use, not at import time: locally the Cognito IDs may be unset, and the API
// should still start (public routes work without Cognito).
let verifier: ReturnType<typeof createVerifier> | undefined;
function createVerifier() {
  return CognitoJwtVerifier.create({
    userPoolId: config.cognito.userPoolId,
    clientId: config.cognito.clientId,
    tokenUse: "access",
  });
}

// Throws if the token is invalid or expired.
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  verifier ??= createVerifier();
  const payload = await verifier.verify(token);
  return { sub: payload.sub, groups: payload["cognito:groups"] ?? [] };
}
