# 0003 — Auth: BFF pattern, access token in memory, refresh token in an HttpOnly cookie

- **Status:** accepted
- **Date:** 2026-10-08

## Context

A browser app needs to hold credentials somewhere. Every option trades XSS risk against CSRF risk and UX:

| Storage | XSS can steal it? | Sent automatically (CSRF)? |
|---|---|---|
| localStorage / sessionStorage | **Yes** | No |
| JS memory | Only while the page is open, and only the short-lived token | No |
| Readable cookie | **Yes** | Yes |
| HttpOnly cookie | No | Yes (mitigate with SameSite + a custom header) |

## Decision

**Backend-for-frontend (BFF):** the Fastify API talks to Cognito for the browser.
- Login returns the **access token (15 min) in the body**; the web app keeps it **in memory** (`web/src/lib/token-store.ts`).
- The **refresh token (7 days) is an HttpOnly, Secure, SameSite=Strict cookie scoped to `/api/auth`**.
- `/api/auth/refresh` and `/logout` also require `x-csrf: 1`.
- CloudFront serves web and API from one origin, so the cookie is first-party and no CORS is needed.
- On page load the app calls `/api/auth/refresh`; on a 401 the fetch wrapper refreshes once and retries.

## Alternatives

- **Amplify Auth / tokens in localStorage:** simplest, but any XSS steals a week-long session.
- **Server sessions only** (shown in the session demo): instant revocation, but a database read on every request and
  stateful scaling; and AppSync/API Gateway authorizers want JWTs.
- **Managed login + PKCE in the browser (public SPA client):** standard OAuth for SPAs, but tokens end up in the browser
  anyway. Kept as a server-side demo (`/api/auth/oauth/*`).

## Consequences

- XSS can at most use the in-memory access token while the tab is open (15 minutes), and CSP limits XSS further.
- Logging out revokes the refresh token; already-issued access tokens stay valid until they expire ("how do you log out
  a JWT?": short lifetimes + revocation of the refresh token, or a denylist checked by the API).
- Same-origin hosting is required in production; local dev uses a strict CORS allow-list for `localhost:3001`.
