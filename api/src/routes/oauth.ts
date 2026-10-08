// The authorization code + PKCE demo with Cognito managed login. CONCEPT: oauth-pkce
//   1. GET /api/auth/oauth/start    -> make verifier + state, remember them in a short cookie, redirect to Cognito
//   2. (user logs in on Cognito's page)
//   3. GET /api/auth/oauth/callback -> check state, swap code + verifier for tokens, set the refresh cookie,
//                                      redirect to the web app (which then calls /api/auth/refresh)
import { z } from "zod";
import { badRequest } from "../errors";
import { authorizeUrl, exchangeCode } from "../lib/cognito-oauth";
import { config } from "../config";
import { challengeFor, createState, createVerifier } from "../services/pkce";
import type { App } from "../types";
import { REFRESH_COOKIE, refreshCookieOptions } from "./auth";

const PKCE_COOKIE = "pkce";
// SameSite=Lax, not Strict: the callback is a top-level redirect FROM Cognito's domain, and a Strict
// cookie would not be sent on it. Lax cookies are sent on top-level GET navigations.
const pkceCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/auth/oauth",
  maxAge: 5 * 60, // a login must finish within 5 minutes
};

const CallbackQuery = z.object({ code: z.string().min(1), state: z.string().min(1) });

export function oauthRoutes(app: App) {
  app.get("/auth/oauth/start", async (_request, reply) => {
    const verifier = createVerifier();
    const state = createState();
    reply.setCookie(PKCE_COOKIE, `${state}.${verifier}`, pkceCookieOptions);
    return reply.redirect(authorizeUrl(state, challengeFor(verifier)));
  });

  app.get("/auth/oauth/callback", { schema: { querystring: CallbackQuery } }, async (request, reply) => {
    // Step 1: the state must match the one we stored, or this callback isn't from our own login.
    const [state, verifier] = (request.cookies[PKCE_COOKIE] ?? "").split(".");
    if (!state || !verifier || state !== request.query.state) throw badRequest("Login expired. Start again.");
    reply.clearCookie(PKCE_COOKIE, { path: pkceCookieOptions.path });

    // Step 2: code + verifier -> tokens (server to server; the tokens never appear in a URL).
    const tokens = await exchangeCode(request.query.code, verifier);
    reply.setCookie(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions);

    // Step 3: back to the app. Its usual "refresh on page load" picks up the new session.
    return reply.redirect(`${config.appUrl}/?login=pkce`);
  });
}
