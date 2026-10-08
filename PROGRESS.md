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
| M5 | EventBridge/SQS/SNS, email worker, search (flag), Redis cache + rate limit (flag), CloudFront caching | todo |
| M6 | Powertools, alarms, dashboard, WAF (flag), partner API, optional SQL (flag) | todo |
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

## Open questions

- None yet. (Untested until the first deploy: real Cognito login, managed-login PKCE redirect, CloudFront routing. The unit tests mock these.)

## Next steps

- M5: `events.ts` (EventBridge bus `ticketlite`, rules → SQS email-queue + DLQ → email-worker (SES), SNS admin-notifications), saga publishes BookingConfirmed/BookingFailed, admin create publishes EventCreated, Events stream → search-indexer (bisect, retries, on-failure), `search.ts` (flag) + mapping/analyzer + `/api/search` with DynamoDB fallback + search page, Redis cache-aside + stampede lock + invalidation + sliding-window rate limit (flag, no-op cache otherwise), `secrets.ts`, CloudFront 30s cache policy for `/api/events`.
- Later optimization (not in spec): the api bundle is ~2 MB minified (AWS SDK + Swagger UI). Check with an esbuild metafile if cold starts matter.
