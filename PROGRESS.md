# Progress

Build progress for [BUILD-SPEC.md](BUILD-SPEC.md). A new session continues from here.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Workspace setup | ✅ done — `pulumi preview`: 10 to create (nothing deployed yet) |
| M1 | Refactor api/infra, CloudFront + S3 + web skeleton, CI/CD | ✅ done — `pulumi preview`: 28 to create; actionlint clean |
| M2 | DynamoDB + repositories + seed, events REST, Cognito BFF auth, session demo, web read pages | todo |
| M3 | Booking saga, idempotency, admin CRUD, poster upload | todo |
| M4 | AppSync, N+1 batch resolver, subscriptions, live seat count | todo |
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

## Open questions

- None yet.

## Next steps

- M2: DynamoDB tables + repositories + seed (+ `seed.yml`), events REST routes (ETag, Cache-Control, cursor pagination), Cognito + BFF auth + JWT authorizer, session demo, web: React Query, list/detail/auth pages, component tests.
