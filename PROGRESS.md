# Progress

Build progress for [BUILD-SPEC.md](BUILD-SPEC.md). A new session continues from here.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Workspace setup | ✅ done — `pulumi preview`: 10 to create (nothing deployed yet) |
| M1 | Refactor api/infra, CloudFront + S3 + web skeleton, CI/CD | todo |
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

## Open questions

- None yet.

## Next steps

- M1: refactor api into layers under `/api`, rename infra files per §14, add CloudFront + S3 + web skeleton, write ci/deploy/destroy/seed workflows.
- Note for M1: the `dev` stack has never been deployed (preview shows only creates), so Pulumi logical names can change freely.
