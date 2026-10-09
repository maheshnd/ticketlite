# 0011 — Explicit HTTP API routes (vs one catch-all route)

- **Status:** accepted
- **Date:** 2026-10-09

## Context

One Fastify Lambda serves every REST route (ADR 0001). In front of it, the HTTP API can either list every route
(`GET /api/events/{id}`, `POST /api/bookings`, …) or send everything to the Lambda with one catch-all
(`ANY /api/{proxy+}`) and let Fastify route.

With explicit routes, two lists must agree: the Fastify routes and `infra/http-route-list.ts`. They drifted once:
`GET /api/search` and `GET /api/admin/reports` worked locally (no API Gateway) but API Gateway would have answered
404 in AWS. The unit tests call Fastify directly, so nothing caught it.

## Decision

- **Keep explicit routes**, in a plain-data file (`infra/http-route-list.ts`) that `infra/http-routes.ts` turns into
  routes, split into public, protected (JWT authorizer) and flag-gated (`sqlRoutes`, only with `enableSql`).
- **Guard the drift with a unit test** (`api/test/http-routes.test.ts`): it builds the app, lists every Fastify route
  under `/api`, and fails with the exact route keys when one list has a route the other lacks.

## Alternatives

- **Catch-all `ANY /api/{proxy+}`:** one route, nothing to keep in sync, new routes work at once. But:
  - every unknown path (scanners probing `/api/wp-login.php`, typos) invokes the Lambda: cost, cold starts, log noise.
    Explicit routes make API Gateway answer 404 for free;
  - auth is all-or-nothing per route: public and protected paths would share one route, so the JWT authorizer
    couldn't run on just the protected ones. Either every request pays for it (and public pages break), or
    no request does and only Fastify checks tokens (no rejection before the Lambda);
  - per-route throttling (`POST /api/bookings`: 5 rps) and per-route metrics/access-log grouping need real routes.
- **Two catch-alls** (`ANY /api/{proxy+}` public + `ANY /api/admin/{proxy+}` protected): fewer routes, but auth then
  depends on URL layout (`/api/bookings` is protected yet not under `/admin`) and throttling is still coarse.
- **Generate the infra routes from Fastify at build time:** one source of truth, but `infra/` would have to import and
  boot the API (its dependencies, its config) inside `pulumi preview`. Too much coupling for this project.

## Consequences

- Adding a Fastify route means adding one line to `infra/http-route-list.ts`; forgetting it fails `pnpm test` in CI,
  with a message that names the route and the file.
- A route behind a cost flag can be left out of API Gateway while the flag is off (API Gateway's 404 reaches the web
  app as a normal 404).
- The test treats `{proxy+}` as "any path below" (the Swagger UI's many files) and ignores parameter names
  (`{id}` vs `:id`), because API Gateway only cares about the number of path segments.
