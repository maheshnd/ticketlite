// Fake auth API. One known user: test@ticketlite.dev / Tickets2026x (an admin, so admin pages work too).
// `loggedIn` stands in for the HttpOnly refresh cookie: after a login, /refresh returns a token.
import { HttpResponse, http } from "msw";
import { problem } from "./problem";

let loggedIn = false;
export const resetAuthState = () => {
  loggedIn = false;
};

const tokens = () => HttpResponse.json({ accessToken: "mock-access-token", expiresIn: 900 });

export const authHandlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== "Tickets2026x") {
      return problem(401, "Unauthorized", "Wrong email or password, or the session has ended. Log in again.");
    }
    loggedIn = true;
    return tokens();
  }),
  http.post("*/api/auth/refresh", () =>
    loggedIn ? tokens() : problem(401, "Unauthorized", "Not logged in."),
  ),
  http.post("*/api/auth/logout", () => {
    loggedIn = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("*/api/auth/signup", () => HttpResponse.json({ confirmed: false }, { status: 201 })),
  http.post("*/api/auth/confirm", () => new HttpResponse(null, { status: 204 })),
  http.post("*/api/auth/forgot", () => new HttpResponse(null, { status: 202 })),
  http.post("*/api/auth/reset", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/me", () =>
    HttpResponse.json({ userId: "user-1", email: "test@ticketlite.dev", groups: ["admin"] }),
  ),
];
