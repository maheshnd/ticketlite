// The session-based login demo, to compare with JWTs. CONCEPT: sessions-vs-jwt
//
//   Session (this file): the server stores a session row; the cookie holds only a random id.
//     + Logout is instant: delete the row.   - Every request reads the database.
//   JWT (the rest of the app): the token itself carries the user's identity, signed by Cognito.
//     + No database read to authenticate.     - A token stays valid until it expires (we keep that
//       short, 15 min, and revoke the refresh token on logout).
import { randomBytes } from "node:crypto";
import { unauthorized } from "../errors";
import { verifyAccessToken } from "../lib/jwt";
import { deleteSession, getSession, putSession, type Session } from "../repositories/sessions-repository";
import { login } from "./auth-service";

const SESSION_SECONDS = 60 * 60; // 1 hour

// Step 1: check the password with Cognito, then create our OWN session row.
export async function startSession(email: string, password: string): Promise<Session> {
  const { accessToken } = await login(email, password);
  const { sub } = await verifyAccessToken(accessToken);
  const session: Session = {
    sessionId: randomBytes(32).toString("base64url"), // unguessable: 256 random bits
    userId: sub,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  await putSession(session);
  return session;
}

// Step 2: look the session up on every request. TTL deletes expired rows only eventually (often within
// minutes, up to ~48h), so we must also check expiresAt ourselves. CONCEPT: ttl
export async function readSession(sessionId: string | undefined): Promise<Session> {
  const session = sessionId ? await getSession(sessionId) : undefined;
  if (!session || session.expiresAt < Date.now() / 1000) throw unauthorized("No active session.");
  return session;
}

// Step 3: logout = delete the row. The very next request with this cookie fails.
export async function endSession(sessionId: string | undefined) {
  if (sessionId) await deleteSession(sessionId);
}
