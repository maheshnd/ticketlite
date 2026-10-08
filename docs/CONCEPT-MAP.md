# Concept map

Every concept TicketLite demonstrates → the files that show it → how to see it → how to break it.
Search the code for `CONCEPT: <tag>` to find every place a concept appears. `pnpm check:concepts` (run in CI)
fails if a tag in the code is missing from this file.

> Filled in milestone by milestone. M7 completes it with all 12 learning topics and the backend concepts.

## `CONCEPT:` tags

| Tag | Files | How to see it | How to break it |
|---|---|---|---|
| `accessibility` | `web/eslint.config.mjs`, `web/src/app/layout.tsx`, `web/src/app/globals.css` | Tab through the page: "Skip to content" appears first; focus rings are visible | Add `<img src="x.png" />` without `alt`; `pnpm lint` fails (jsx-a11y) |
| `api-mocking` | `web/src/mocks/handlers.ts`, `web/src/mocks/server.ts` | `pnpm --filter @ticketlite/web test`: components make real `fetch` calls that MSW answers | Remove a handler: `onUnhandledFrame: "error"` fails the test loudly |
| `authentication` | `infra/cognito.ts`, `infra/http-routes.ts` | `curl $CLOUDFRONT/api/me` → 401 from API Gateway (the Lambda never runs) | Drop `authorizationType: "JWT"` from `/api/me`: unauthenticated calls reach Lambda and cost money |
| `authentication-vs-authorization` | `api/src/plugins/auth-context.ts` | `requireUser` = who are you (401); `requireAdmin` = may you (403) | Check only `requireUser` on admin routes: any logged-in user becomes an admin |
| `bff` | `api/src/routes/auth.ts`, `web/src/lib/api-client.ts` | Login response body has only `accessToken`; DevTools → Application → Cookies shows `refresh_token` as HttpOnly | Return the refresh token in the body and store it in localStorage: one XSS steals a week-long session |
| `cdn` | `infra/cdn.ts`, `.github/workflows/deploy.yml` | `curl -I $CLOUDFRONT/_next/static/...` → `x-cache: Hit from cloudfront`, `cache-control: ...immutable` | Upload HTML with `max-age=31536000`: users keep seeing old pages after a deploy |
| `cold-start` | `api/src/lambda.ts`, `api/src/routes/copy-info.ts`, `api/build.mjs`, `infra/lambdas.ts` | Call `/api/copy-info` repeatedly: same `bornAt` = warm; wait ~15 min, call again: new `bornAt` | Build the app inside the handler: every request pays the init cost |
| `connection-reuse` | `api/src/lambda.ts` | AWS SDK clients are created at module level (M2) and reused by warm invocations | Create a client per request: extra TLS handshakes, slower p99 |
| `correlation-id` | `api/src/plugins/correlation-id.ts` | `curl -H 'x-correlation-id: abc' .../api/health -i` → same header back; search logs for `abc` | Remove the header validation: a caller can inject newlines into logs |
| `cors` | `api/src/plugins/cors.ts`, `infra/http-api.ts` | Local only: preflight from `http://localhost:3001` gets `access-control-allow-origin` | Set `origin: "*"` with `credentials: true`: browsers refuse it, and it would be unsafe anyway |
| `cost-safety` | `infra/config.ts`, `infra/node-function.ts`, `infra/Pulumi.dev.yaml` | Every paid service is behind a flag that defaults to `false`; log groups keep 7 days | Let Lambda create its own log group: logs are kept (and billed) forever |
| `csrf` | `api/src/routes/auth.ts`, `web/src/lib/api-client.ts` | `curl -X POST .../api/auth/refresh --cookie refresh_token=x` → 403 (no `x-csrf` header) | Remove `requireCsrfHeader` and set `SameSite=None`: another site could refresh (and use) your session |
| `defense-in-depth` | `api/src/lib/jwt.ts` | The API re-verifies tokens API Gateway already checked | Trust any `Authorization` header in Fastify: a misconfigured route skips all auth |
| `distributed-tracing` | `api/src/plugins/correlation-id.ts`, `infra/node-function.ts` | X-Ray console → Traces: each Lambda call with its AWS SDK calls | Turn `tracingConfig` off: no service map |
| `dynamodb-access-patterns` | `infra/dynamodb.ts`, `api/src/repositories/events-repository.ts` | Access patterns listed at the top of each repository; each is one GetItem or Query | Replace the byCity Query with a Scan + filter: cost grows with the whole table |
| `encryption-at-rest` | `infra/storage.ts` | S3 console → bucket → Properties → Default encryption: SSE-S3 | (Can't be turned off for new S3 objects since 2023) |
| `error-handling` | `api/src/plugins/error-handler.ts`, `api/src/errors.ts` | `curl .../api/nope` → `application/problem+json` with `correlationId` | Return `error.message` in the 500 branch: internals (table names) leak |
| `fail-fast` | `api/src/config.ts` | `STAGE= LOG_LEVEL=loud pnpm --filter @ticketlite/api dev` → crashes at startup with a clear Zod error | Read `process.env` inside handlers: typos fail on a random request, later |
| `http-caching` | `api/src/routes/events.ts` | `curl -i .../api/events/evt-003` → `etag`; send it back as `If-None-Match` → `304` with no body | Use `max-age=3600` on the detail: users see stale seat counts for an hour |
| `idempotency` | `infra/dynamodb.ts` (IdempotencyKeys table) | Used by `POST /api/bookings` in M3 | — |
| `jwt` | `api/src/lib/jwt.ts`, `infra/http-routes.ts` | Paste an access token into jwt.io: `sub`, `cognito:groups`, `client_id`, `exp` (15 min) | Skip signature verification: anyone can forge `cognito:groups: ["admin"]` |
| `jwt-logout` | `api/src/lib/cognito.ts` (`revokeRefreshToken`) | Log out → `/api/auth/refresh` returns 401; the old access token still passes API Gateway until it expires (≤ 15 min) | Set access tokens to 1 day: a stolen token works for a day after logout |
| `lambda-versions` | `infra/lambdas.ts` | Lambda console → Aliases → `live` points at a numbered version | Point API Gateway at `$LATEST`: no rollback target, no canary |
| `least-privilege` | `infra/iam.ts`, `infra/node-function.ts` | IAM console → each function's role has only logs, X-Ray and its own inline policy | Attach `AdministratorAccess` to a function role |
| `oauth-pkce` | `api/src/routes/oauth.ts`, `api/src/services/pkce.ts`, `api/src/lib/cognito-oauth.ts`, `infra/cognito.ts` | Login page → "Log in with Cognito": redirect carries `code_challenge`; callback swaps `code` + verifier | Send the verifier in the authorize URL: a stolen code can be redeemed by anyone |
| `optimistic-locking` | `packages/shared/src/event.ts` | Added in M3 (admin edits) | — |
| `origin-access-control` | `infra/cdn.ts` | `curl https://<bucket>.s3.amazonaws.com/index.html` → 403; via CloudFront → 200 | Remove the `AWS:SourceArn` condition: any distribution could read the bucket |
| `pagination` | `packages/shared/src/pagination.ts`, `api/src/repositories/cursor.ts`, `web/src/features/events/events-queries.ts` | `/api/events?limit=3` → `nextCursor`; pass it back for page 2 | Use page numbers with DynamoDB: there is no "skip N", so page 50 reads 49 pages first |
| `prefetching` | `web/src/features/events/events-queries.ts`, `EventCard.tsx` | DevTools Network: hovering an event fetches `/api/events/<id>` before the click | Prefetch every card on render: dozens of requests nobody needed |
| `query-key-factory` | `web/src/lib/query-keys.ts` | `eventKeys.lists()` invalidates every list at once (M3 admin edits) | Hand-write keys like `["event", id]` and `["events", id]`: invalidation silently misses one |
| `rbac` | `api/src/plugins/auth-context.ts`, `infra/http-routes.ts`, `infra/cognito.ts` (admin group) | A user outside the `admin` group gets 403 on admin routes (M3) | Read the role from a request body field instead of the signed token |
| `react-query` | `web/src/lib/query-client.ts`, `web/src/features/events/events-queries.ts`, `web/eslint.config.mjs` | Navigate list → detail → back: the list shows instantly from cache (staleTime 30s) | Retry 4xx errors: a 404 is retried three times before the user sees it |
| `read-consistency` | `api/src/repositories/events-repository.ts`, `sessions-repository.ts` | `getEventById(id, { consistent: true })` vs the default; sessions always read consistently | Read sessions eventually-consistently: right after logout the old session may still work for a moment |
| `repository-pattern` | `api/src/repositories/*` | Services never import the AWS SDK; only repositories do | Call DynamoDB from a route: the access pattern is hidden in HTTP code and hard to test |
| `s3-security` | `infra/storage.ts` | S3 console → Permissions → "Block all public access: On" | Turn off `blockPublicPolicy` and add a `Principal: "*"` policy |
| `same-origin` | `api/src/config.ts`, `infra/cdn.ts` | Web and API share the CloudFront domain: no CORS preflight in the browser's network tab | Call the `execute-api` URL from the browser: CORS errors, and the cookie isn't first-party |
| `schema-validation` | `packages/shared/src/event.ts` | `pnpm --filter @ticketlite/shared test` | Remove `.nonnegative()` from `price`; the "rejects a negative price" test fails |
| `security-headers` | `infra/cdn.ts` | `curl -I $CLOUDFRONT/` → `strict-transport-security`, `content-security-policy`, `x-frame-options` | Remove the response headers policy: the site can be framed (clickjacking) |
| `sessions-vs-jwt` | `api/src/services/session-service.ts`, `api/src/routes/demo-session.ts` | `POST /api/demo/session/login`, then `/me`, then `/logout`: the cookie stops working instantly | Store the user id in the cookie itself without a signature: anyone can become anyone |
| `structured-logging` | `api/src/app.ts` | CloudWatch Logs Insights: `fields correlationId, res.statusCode \| filter res.statusCode >= 500` | Log with string concatenation: fields can't be queried |
| `throttling` | `infra/http-api.ts` | Fire > 40 requests at once: API Gateway answers 429 before Lambda runs | Remove `defaultRouteSettings`: one script can run up the bill |
| `timeout-chain` | `infra/lambdas.ts`, `infra/node-function.ts`, `infra/http-api.ts` | API Gateway 29s > Lambda 10s > SDK calls (M2) | Make the Lambda timeout 60s: API Gateway gives up first and the user sees a 503 while Lambda keeps running (and billing) |
| `token-storage` | `web/src/lib/token-store.ts`, `api/src/routes/auth.ts`, `packages/shared/src/auth.ts` | Reload the page: the access token is gone from memory and restored via `/api/auth/refresh` | Put the token in localStorage: any injected script can read it |
| `ttl` | `infra/dynamodb.ts`, `api/src/repositories/sessions-repository.ts`, `api/src/services/session-service.ts` | Sessions get `expiresAt` (epoch seconds); DynamoDB deletes them for free, eventually | Rely on TTL alone: expired sessions can still be read for hours |
| `user-enumeration` | `api/src/services/auth-service.ts`, `infra/cognito.ts` (`preventUserExistenceErrors`) | `POST /api/auth/forgot` with an unknown email → 202, same as a real one | Return "no such user": attackers learn which emails have accounts |
| `xss` | `infra/cdn.ts` | The CSP blocks scripts from other origins (browser console shows a CSP violation) | Add `script-src *`: injected third-party scripts would run |
