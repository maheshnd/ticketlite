# Code review checklist (and how this codebase is organized)

For reviewers and for new team members. Pairs with CLAUDE.md (the rules) and docs/ARCHITECTURE.md (the picture).

## Checklist

**Correctness**
- [ ] Inputs validated with a Zod schema from `packages/shared` (body, params, query, headers)?
- [ ] Every DynamoDB access is a GetItem/Query on a documented access pattern (no Scan in request paths)?
- [ ] Concurrent writes safe? (conditional expressions, transactions, `version` for edits)
- [ ] Retry-safe? A step or consumer that runs twice changes nothing the second time (idempotency).
- [ ] Errors: known cases throw `HttpError` helpers; nothing leaks internals in a 500.

**Security**
- [ ] Authorization on the server (`requireUser` / `requireAdmin`, ownership checks), not just hidden UI?
- [ ] IAM: the role gets only the new action, only on the new resource?
- [ ] No secrets in code, env vars, logs or Pulumi config; tokens never logged?
- [ ] User input never concatenated into expressions, SQL, URLs or HTML?

**Operability**
- [ ] Logs are structured and carry `correlationId`; no `console.log` of whole payloads?
- [ ] Timeouts: SDK/fetch timeouts shorter than the Lambda timeout, which is shorter than API Gateway's?
- [ ] Failure path: DLQ / on-failure destination / alarm for anything asynchronous?
- [ ] Cost: new paid resource behind a flag? Log group with 7-day retention?

**Readability (this is a learning codebase)**
- [ ] Header comment (what, why, which concept) and `// Step n:` comments explaining WHY?
- [ ] New concept tagged `// CONCEPT: <tag>` and added to docs/CONCEPT-MAP.md (`pnpm check:concepts`)?
- [ ] One job per file, under ~150 lines, no new abstraction layer without a reason?

**Tests and docs**
- [ ] A test named after the behaviour (`it("returns 409 when the event version is stale")`)?
- [ ] SERVICE-MAP.md updated if an AWS service was added or used differently? ADR for a real decision?
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` green; `pulumi preview` read in the PR comment?

## Onboarding notes (mentoring)

1. **Start with a request.** Follow `GET /api/events/:id` from `web/src/features/events` → `api/src/routes/events.ts`
   → `services/events-service.ts` → `repositories/events-repository.ts` → `infra/dynamodb.ts`. Every feature has the same shape.
2. **Contracts first.** `packages/shared` holds the schemas both sides use; change them first, then the compiler
   shows every place to update.
3. **Async work is in `functions/`**, each with a README answering: what triggers it, sync or async, retries, where
   failures go, which permissions.
4. **Infra mirrors the services:** `infra/<service-area>.ts`. Read `index.ts` for the list.
5. **Run it locally:** `docker compose up -d`, `pnpm db:local`, `pnpm --filter @ticketlite/api dev`; or the whole UI
   with mocks: `pnpm e2e` (or `pnpm --filter @ticketlite/e2e build:mock` and `node e2e/serve.mjs`).
6. **Good first changes:** a new field on Event (schema → repository → UI → test), a new alarm, a new EventBridge
   consumer. Each touches one layer at a time.
