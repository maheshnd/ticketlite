# Learning path

Study order for the 12 topics. Each step: what to read (in this order), then experiments to run. Interview
angles for every concept are in [CONCEPT-MAP.md](CONCEPT-MAP.md); the "why" behind decisions is in [adr/](adr/README.md).

Setup once: `pnpm install`, `docker compose up -d`, `pnpm db:local`, `pnpm --filter @ticketlite/api dev`.

## 1. Serverless fundamentals
- Read: [ARCHITECTURE.md](ARCHITECTURE.md) §1–2, [SERVICE-MAP.md](../SERVICE-MAP.md), `notes/00 aws foundations.md`.
- Try: trace one request in the request-path diagram, naming the AWS service and file at each hop.

## 2. AWS Lambda
- Read: `api/src/lambda.ts`, `api/src/routes/copy-info.ts`, `infra/node-function.ts`, `infra/lambdas.ts`, `api/build.mjs`, ADR 0001.
- Try: call `/api/copy-info` repeatedly (warm), wait 15 min (cold). Compare the bundle size before/after removing `minify`.
  Set `enableProvisionedConcurrency` in a branch and read the preview. Explain why the app is built outside the handler.

## 3. API Gateway
- Read: `infra/http-api.ts`, `infra/http-routes.ts`, `infra/partner-api.ts`.
- Try: call `/api/me` without a token (401 from API Gateway, no Lambda log). Call the partner API with/without
  `x-api-key`. Read the access logs in CloudWatch. Compare HTTP vs REST features in the concept map.

## 4. DynamoDB
- Read: `infra/dynamodb.ts`, `api/src/repositories/*` (access patterns at the top), `functions/booking-reserve-seat`, ADR 0002.
- Try: page through `/api/events?limit=2`; tamper with the cursor (400). Seed an event with 1 seat and book it twice
  from two tabs. Explain `Limit` vs `FilterExpression`, and eventual vs strong reads.

## 5. GraphQL
- Read: `graphql/schema.graphql`, `graphql/README.md`, `web/codegen.ts`.
- Try: run `events { items { name organizer { name } } }` in the AppSync console; count organizer Lambda invocations
  with `maxBatchSize` 20 vs 0 (N+1). Break a field name in `OrganizerName.tsx` and watch `typecheck` fail.

## 6. AppSync
- Read: `infra/appsync.ts`, `infra/appsync-resolvers.ts`, `graphql/resolvers/*`, `functions/shared/appsync.ts`, `web/src/lib/appsync-realtime.ts`, ADR 0006.
- Try: `AWS_PROFILE=ticketlite pnpm --filter @ticketlite/graphql evaluate`. Open an event in two tabs and book in one.
  Call `publishSeatUpdate` with the API key (Unauthorized: IAM only).

## 7. OpenSearch
- Read: [SEARCH.md](SEARCH.md), `packages/shared/src/search.ts`, `functions/search-indexer`, `api/src/services/search-service.ts`.
- Try (locally): `scripts/index-local-search.ts`, then `/api/search?q=jaz`, `q=nights`, `&city=`. Run
  `curl localhost:9200/events/_analyze -H 'content-type: application/json' -d '{"analyzer":"event_name","text":"Café Nights"}'`.

## 8. Event-driven serverless
- Read: [EVENT-DRIVEN.md](EVENT-DRIVEN.md), `infra/events.ts`, `infra/stepfunctions.ts` + `booking-state-machine.md`,
  `functions/email-worker`, `functions/booking-*`, ADRs 0004/0005.
- Try: book an event priced 10.13 (compensation path). Set `paymentFailureRate: 0.5` and read the retries in the
  execution history. Break SES and watch a message reach the DLQ; redrive it ([RUNBOOK.md](RUNBOOK.md)).

## 9. Security and observability
- Read: [SECURITY.md](SECURITY.md), `infra/iam.ts`, `infra/cognito.ts`, `api/src/routes/auth.ts`, `infra/observability.ts`, ADRs 0003/0007.
- Try: inspect the cookie flags in DevTools; call refresh without `x-csrf`. Find one booking end to end by
  correlation ID in Logs Insights; open its X-Ray trace. Trigger the `booking-saga-failed` alarm on purpose.

## 10. Infrastructure and CI/CD
- Read: `infra/index.ts` then each file, `.github/workflows/*`, `bootstrap/`, [CICD-SETUP.md](CICD-SETUP.md), ADR 0010.
- Try: open a PR and read the preview comment. Flip a flag in a branch and compare resource counts. Roll back the api
  alias by hand ([RUNBOOK.md](RUNBOOK.md#roll-back-a-deploy)).

## 11. Production system design
- Read: [CACHING.md](CACHING.md), `api/src/services/idempotency-service.ts`, `functions/booking-process-payment/circuit-breaker.ts`,
  ADR 0008, ADR 0009.
- Try: turn on `enableCache` locally (`CACHE_ENABLED=true REDIS_URL=redis://localhost:6379`), watch `event:*` keys and
  TTLs. Measure Core Web Vitals with Lighthouse on the CloudFront URL. Sketch how to scale to 10× traffic: what breaks first?

## 12. Technical lead topics
- Read: all ADRs, [CODE-REVIEW.md](CODE-REVIEW.md), PROGRESS.md (decisions and deviations), CLAUDE.md (team rules).
- Try: write an ADR for a change you'd make (e.g. single-table design, Express workflows, SSR). Review one recent
  commit with the checklist. Explain to someone new how a request flows, using only the onboarding notes.
