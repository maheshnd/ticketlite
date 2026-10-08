// Auth routes for the BFF (backend-for-frontend) pattern. CONCEPT: bff, token-storage, csrf
//   - The ACCESS token goes in the response body. The web app keeps it in memory only (never localStorage,
//     where any XSS could read it).
//   - The REFRESH token goes in an HttpOnly cookie that JavaScript can't read at all, scoped to /api/auth.
//   - refresh/logout need the custom header "x-csrf: 1" as well as the cookie: another site can make the
//     browser SEND our cookie, but it can't add a custom header without a CORS preflight we'd refuse.
import type { CookieSerializeOptions } from "@fastify/cookie";
import {
  ConfirmInputSchema,
  ForgotInputSchema,
  LoginInputSchema,
  ResetInputSchema,
  SignupInputSchema,
  TokenResponseSchema,
} from "@ticketlite/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../errors";
import * as auth from "../services/auth-service";
import type { App } from "../types";

export const REFRESH_COOKIE = "refresh_token";
export const refreshCookieOptions: CookieSerializeOptions = {
  httpOnly: true, // invisible to JavaScript, so XSS can't steal it
  secure: true, // HTTPS only (browsers treat http://localhost as secure, so local dev works)
  sameSite: "strict", // never sent on requests started by another site
  path: "/api/auth", // only sent to the auth routes, not to every API call
  maxAge: 7 * 24 * 60 * 60, // seconds; matches the Cognito refresh token validity
};

// Sets the refresh cookie (when Cognito returned one) and returns the body for the web app.
export function sendTokens(reply: FastifyReply, tokens: auth.Tokens) {
  if (tokens.refreshToken) reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}

function requireCsrfHeader(request: FastifyRequest) {
  if (request.headers["x-csrf"] !== "1") throw forbidden("Missing the x-csrf header.");
}

export function authRoutes(app: App) {
  // 201: the account exists but is unconfirmed until the emailed code is entered.
  app.post("/auth/signup", { schema: { body: SignupInputSchema } }, async (request, reply) => {
    await auth.signUp(request.body.email, request.body.password);
    return reply.code(201).send({ email: request.body.email, confirmed: false });
  });

  app.post("/auth/confirm", { schema: { body: ConfirmInputSchema } }, async (request, reply) => {
    await auth.confirmSignUp(request.body.email, request.body.code);
    return reply.code(204).send();
  });

  app.post(
    "/auth/login",
    { schema: { body: LoginInputSchema, response: { 200: TokenResponseSchema } } },
    async (request, reply) => sendTokens(reply, await auth.login(request.body.email, request.body.password)),
  );

  // Called on every page load to restore the session: the access token lives only in memory.
  app.post(
    "/auth/refresh",
    { schema: { response: { 200: TokenResponseSchema } } },
    async (request, reply) => {
      requireCsrfHeader(request);
      const refreshToken = request.cookies[REFRESH_COOKIE];
      if (!refreshToken) throw unauthorized("Not logged in.");
      return sendTokens(reply, await auth.refresh(refreshToken));
    },
  );

  // 204 even if already logged out: logout is idempotent.
  app.post("/auth/logout", async (request, reply) => {
    requireCsrfHeader(request);
    await auth.logout(request.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: refreshCookieOptions.path });
    return reply.code(204).send();
  });

  // 202 whether or not the email exists, so this can't be used to discover accounts.
  app.post("/auth/forgot", { schema: { body: ForgotInputSchema } }, async (request, reply) => {
    await auth.forgotPassword(request.body.email);
    return reply.code(202).send();
  });

  app.post("/auth/reset", { schema: { body: ResetInputSchema } }, async (request, reply) => {
    await auth.resetPassword(request.body.email, request.body.code, request.body.newPassword);
    return reply.code(204).send();
  });
}
