// Authentication + authorization helpers used as route `preHandler`s.
//   requireUser:  "who are you?"  -> a valid Cognito access token is required (else 401)
//   requireAdmin: "may you do this?" -> the user must be in the "admin" group (else 403)
// CONCEPT: authentication-vs-authorization, rbac
import type { FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../errors";
import { verifyAccessToken } from "../lib/jwt";

export type AuthUser = { userId: string; groups: string[]; accessToken: string };

// Adds `request.user` to Fastify's request type.
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// Step 1: read "Authorization: Bearer <token>" and verify it. Sets request.user.
export async function requireUser(request: FastifyRequest) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) throw unauthorized();

  try {
    const claims = await verifyAccessToken(token);
    request.user = { userId: claims.sub, groups: claims.groups, accessToken: token };
  } catch {
    throw unauthorized("Your session has expired. Log in again.");
  }
}

// Step 2: role-based access control from the token's "cognito:groups" claim.
export async function requireAdmin(request: FastifyRequest) {
  await requireUser(request);
  if (!request.user?.groups.includes("admin")) throw forbidden("Admins only.");
}

// For handlers that run after requireUser: returns the user, typed as present.
export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw unauthorized();
  return request.user;
}
