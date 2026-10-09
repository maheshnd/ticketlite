// Session-based auth demo: compare with the JWT routes. See services/session-service.ts for the trade-offs.
// The cookie `sid` holds only a random id; the session data lives in the DynamoDB Sessions table.
// CONCEPT: sessions-vs-jwt
import { LoginInputSchema } from "@ticketlite/shared";
import { endSession, readSession, startSession } from "../services/session-service";
import type { App } from "../types";

const SESSION_COOKIE = "sid";
const cookieOptions = { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/api/demo" };

export function demoSessionRoutes(app: App) {
  app.post("/demo/session/login", { schema: { body: LoginInputSchema } }, async (request, reply) => {
    const session = await startSession(request.body.email, request.body.password);
    reply.setCookie(SESSION_COOKIE, session.sessionId, { ...cookieOptions, maxAge: 60 * 60 });
    return { userId: session.userId, expiresAt: session.expiresAt };
  });

  // Every call costs one DynamoDB read: the price of instant logout.
  app.get("/demo/session/me", async (request) => {
    const session = await readSession(request.cookies[SESSION_COOKIE]);
    return { userId: session.userId, expiresAt: session.expiresAt };
  });

  app.post("/demo/session/logout", async (request, reply) => {
    await endSession(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: cookieOptions.path });
    return reply.code(204).send();
  });
}
