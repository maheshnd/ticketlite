# Progress

Build progress for [BUILD-SPEC.md](BUILD-SPEC.md). A new session continues from here.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Workspace setup | ✅ done — `pulumi preview`: 10 to create (nothing deployed yet) |
| M1 | Refactor api/infra, CloudFront + S3 + web skeleton, CI/CD | ✅ done — `pulumi preview`: 28 to create; actionlint clean |
| M2 | DynamoDB + repositories + seed, events REST, Cognito BFF auth, session demo, web read pages | ✅ done — `pulumi preview`: 53 to create; 52 tests |
| M3 | Booking saga, idempotency, admin CRUD, poster upload | ✅ done — `pulumi preview`: 99 to create; ASL validated by AWS; 85 tests |
| M4 | AppSync, N+1 batch resolver, subscriptions, live seat count | ✅ done — `pulumi preview`: 125 to create; all 9 resolvers pass `aws appsync evaluate-code`; 93 tests |
| M5 | EventBridge/SQS/SNS, email worker, search (flag), Redis cache + rate limit (flag), CloudFront caching | ✅ done — `pulumi preview`: 147 to create (157 with search + cache on); search, analyzer and cache checked against local OpenSearch 3.7 + Redis; 109 tests |
| M6 | Powertools, alarms, dashboard, WAF (flag), partner API, optional SQL (flag) | ✅ done — `pulumi preview`: 167 to create (192 with every flag on); 116 tests |
| M7 | Playwright + axe, all docs, final pass | todo |

## Decisions and deviations from the spec

Recorded so the owner can check them. The ADRs in `docs/adr/` explain the bigger ones.

1. **Repo name.** The spec's placeholder `maheshnd/https://github.com/maheshnd/ticketlite` is malformed; we use `maheshnd/ticketlite`.
2. **TypeScript 6.0.x for app packages, 5.9.x for `infra/` and `bootstrap/`.** TypeScript 7 (native) has no JS API, which typescript-eslint (`<6.1`), Next.js and Pulumi (`<7`) need. TS 6.0 is the last release with the JS API.
3. **ESLint 10 with `eslint-plugin-jsx-a11y` 6.10.2.** The plugin's peer range stops at ESLint 9 (last release 2024), but it runs correctly under ESLint 10 (checked). ESLint 9 is end-of-life, so we don't pin it. Expect a peer-dependency warning on install.
4. **pnpm 10.33.2**, as CLAUDE.md pins it (pnpm 12 is the latest).
5. **DynamoDB Local in docker-compose.** The spec lists Redis and OpenSearch only; the local API also needs DynamoDB.
6. **App packages use `moduleResolution: "bundler"`.** No tool emits JS with `tsc`, so imports need no `.js` suffix.
7. **Fresh Pulumi resource names.** The plan said to keep phase-1 logical names, but the `dev` stack has never been deployed (preview showed only creates), so names follow the new files (`http-api`, `api-live`, …).
8. **No CloudFront custom error pages.** `customErrorResponses` apply to the whole distribution, so API 403/404 problem+json responses would be replaced by the web 404 page. CloudFront gets `s3:ListBucket` instead, so a missing page is an honest 404 from S3. `web/out/404.html` still exists for a future Lambda@Edge or origin-group setup.
9. **The AWS SDK is bundled** into each Lambda (not taken from the runtime), so the version is the one in the lockfile and the tests.
10. **Lambda `logFormat: JSON`** (was `Text`): Lambda's own START/END/REPORT lines become JSON too; Fastify/Powertools lines are already JSON and pass through unchanged.
11. **Static-export routing** uses a CloudFront Function (`infra/cdn-rewrite.js`) that maps `/event` → `/event.html`. Dynamic pages use query strings (`/event?id=…`).
12. **`ci.yml` + `deploy.yml` split**: PR checks and the read-only preview moved from `deploy.yml` into `ci.yml`. `deploy.yml` now builds the web app after `pulumi up` (later milestones bake stack outputs into it).
13. **Extra GSI `byStatus` on Events** (PK `status`, SK `startsAt`). The spec only lists `byCity`, but "list all published events" without a city also needs a Query (never a Scan). Documented as a hot-partition trade-off.
14. **`http-api.ts` split into `http-api.ts` + `http-routes.ts`** to avoid an import cycle (CloudFront → API URL, Cognito → CloudFront URL, routes → Cognito authorizer).
15. **The API also verifies JWTs** (`aws-jwt-verify`) even behind API Gateway's JWT authorizer: defense in depth, and it makes local dev work with no API Gateway.
16. **One Cognito app client, no secret**, flows `USER_PASSWORD_AUTH` + `REFRESH_TOKEN_AUTH` + code/PKCE. Refresh-token rotation stays off (Cognito then returns no new refresh token on refresh).
17. **MSW 3** renamed `onUnhandledRequest` to `onUnhandledFrame`.
18. **Root `package.json` is `"type": "module"`** so `tsx` runs the scripts as ESM (top-level await).
19. **Step Functions uses JSONata** (`QueryLanguage: JSONata`), AWS's current recommendation; the definition is a plain `.asl.json` file with `${...}` placeholders, explained in `booking-state-machine.md`.
20. **`MarkFailed` is a direct DynamoDB integration** (no Lambda) for the sold-out path. Handled business failures end in a `Succeed` state; only unhandled ones (`ConfirmFailed`, `CompensationFailed`) fail the execution (and will alarm in M6).
21. **Powertools Logger + Tracer in `functions/` from M3** (spec lists Powertools under M6), so the handlers don't need a rewrite later. M6 adds Metrics.
22. **`packageExtensions` for `aws-sdk-client-mock`** (declares its missing `@smithy/types` dependency); otherwise an old 2.x copy hoisted from `aws-xray-sdk-core` breaks its types.
23. **Idempotency returns 422** when a key is reused with a different body (spec lists 409 for "in progress", which we also return).
24. **Extra admin read routes** `GET /api/admin/events` and `GET /api/admin/events/:id` (the admin list shows drafts; the edit form needs a strongly consistent read with the version).
25. **poster-processor doesn't bump `version`**, so a poster finishing mid-edit doesn't cause a 409.
26. **The HTTP API stage moved to `http-routes.ts`**: per-route throttling (`POST /api/bookings`: 5 rps, burst 10) needs the route to exist first. (The spec puts this in M5; done in M3.)
27. **Saga steps are synchronous Lambda tasks**; the booking amount is `price × seats` rounded to 2 decimals, so an event priced `10.13` triggers the decline path.
28. **`@aws-appsync/eslint-plugin` is not used**: it supports only ESLint ≤9 / TS ≤5. Instead `pnpm --filter @ticketlite/graphql evaluate` runs every bundled resolver in the real APPSYNC_JS runtime (`aws appsync evaluate-code`, read-only).
29. **GraphQL client** (ADR 0006): typed `fetch` for queries (GraphQL Code Generator, `documentMode: "string"`), a hand-written AppSync real-time WebSocket client for `onSeatUpdate`. No Amplify/Apollo.
30. **Admin check in a pipeline function** (`fn-check-admin`), not the `cognito_groups` directive argument, to demonstrate pipelines (as the spec asks). Subscription filtering uses AppSync's built-in argument matching (`eventId`), so no subscription resolver.
31. **Where the web uses GraphQL**: the organizer name on the event page and the live seat count. The list and detail stay on REST to show HTTP caching. The N+1 demo is documented as a console/curl query (`graphql/README.md`).
32. **The AppSync API key is exported unsecret** (`pulumi.unsecret`): it is public by design (shipped in the web JS). Its `expires` is set once (~360 days) and ignored afterwards.
33. **MSW 3**: GraphQL mocks moved to `msw/graphql` and need `graphql.link(url)`; WebSocket mocks (`ws.link`) let the tests run the real AppSync real-time client.
34. **The saga publishes live updates best-effort** (Confirm and ReleaseSeat read the new seat count, then call `publishSeatUpdate` with SigV4; failures only log a warning).
35. **OpenSearch 3.7 on one `t3.small.search`** (verified with `aws opensearch list-instance-type-details`: encryption at rest supported). The domain's access policy delegates to IAM (account principal); Lambda roles get `es:ESHttp*`. Local Docker uses the same 3.7.0.
36. **The search indexer, its stream mapping and failure queue exist only with `enableSearch`** (no domain, nothing to index). `/api/search` falls back to DynamoDB and says so (`source`).
37. **`PublishSoldOut`**: the sold-out path (MarkFailed) also emits `BookingFailed`, via a direct Step Functions → EventBridge integration (no Lambda).
38. **EventCreated has no consumer yet** (published for future subscribers). Publishing it is best effort in the API.
39. **Redis cache TTL is 10 s** (seat counts change with every booking; live updates come from AppSync). The rate limiter fails open and is skipped with the cache flag off (API Gateway's per-route throttle still applies).
40. **Payment signing secret**: created empty; until the owner sets its value, payments run "unsigned" with a warning log (so the first deploy works).
41. **Email recipient**: SES sandbox → every confirmation goes to the verified `sesEmail`, not the booking user's email.
42. **docker-compose Redis host port is configurable** (`REDIS_PORT`), because 6379 was taken on the dev machine.
43. **`scripts/index-local-search.ts`** backfills the local OpenSearch from DynamoDB Local (local dev only).
44. **Alarms**: 7 (≤ 10 free): API 5xx, Lambda errors and throttles across ALL functions (account-level metrics, one alarm each instead of one per function), failed saga executions, and every DLQ/failure queue.
45. **Custom metrics via Powertools EMF**, flushed right after each count (`countMetric`). The API emits `BookingsStarted` only inside Lambda.
46. **Partner API** proxies to the same api Lambda alias (Fastify route `/partner/events`, outside `/api`). The partner key is exported as a Pulumi secret (it is a credential, unlike the AppSync key).
47. **Aurora PostgreSQL 17.11** (18.6 is newest). Both support scale to zero (verified with `describe-db-engine-versions`); 17 chosen because Data API support for 18 isn't confirmable via API. Verify on first enable.
48. **Optional SQL lives in `packages/sql`** (schema, migrations, reports), shared by `functions/sql-reporter` and the API. Migrations run on the reporter's cold start; `/api/admin/reports` answers 404 when the flag is off and 503 + Retry-After while the cluster resumes.
49. **Encryption keys**: service defaults, no customer-managed KMS keys (ADR 0007).

## Open questions

- None blocking. Untested until the first deploy (unit tests mock them): real Cognito login, the managed-login PKCE redirect, CloudFront routing, and that CloudFront forwards the `Authorization` header to API Gateway with `AllViewerExceptHostHeader` + `CachingDisabled` (AWS's documented setup for API Gateway origins).

## Next steps

- M7: Playwright E2E (visitor, user, admin journeys in MSW mock mode) + axe on main pages, in ci.yml and as the post-deploy smoke test; `/learn` page; remaining docs (README, ARCHITECTURE, CONCEPT-MAP 12 topics + backend concepts, LEARNING-PATH, ADRs 0001/0003, COSTS, CODE-REVIEW, per-folder READMEs); coverage report in CI; final consistency pass and the §21 report.
- Later optimization (not in spec): the api bundle is ~2 MB minified (AWS SDK + Swagger UI). Check with an esbuild metafile if cold starts matter.
