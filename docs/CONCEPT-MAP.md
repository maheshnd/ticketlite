# Concept map

Every concept TicketLite demonstrates → the files that show it → how to see it → how to break it.
Search the code for `CONCEPT: <tag>` to find every place a concept appears. `pnpm check:concepts` (run in CI)
fails if a tag in the code is missing from this file.

> Filled in milestone by milestone. M7 completes it with all 12 learning topics and the backend concepts.

## `CONCEPT:` tags

| Tag | Files | How to see it | How to break it |
|---|---|---|---|
| `accessibility` | `web/eslint.config.mjs`, `web/src/app/layout.tsx`, `web/src/app/globals.css` | Tab through the page: "Skip to content" appears first; focus rings are visible | Add `<img src="x.png" />` without `alt`; `pnpm lint` fails (jsx-a11y) |
| `cdn` | `infra/cdn.ts`, `.github/workflows/deploy.yml` | `curl -I $CLOUDFRONT/_next/static/...` → `x-cache: Hit from cloudfront`, `cache-control: ...immutable` | Upload HTML with `max-age=31536000`: users keep seeing old pages after a deploy |
| `cold-start` | `api/src/lambda.ts`, `api/src/routes/copy-info.ts`, `api/build.mjs`, `infra/lambdas.ts` | Call `/api/copy-info` repeatedly: same `bornAt` = warm; wait ~15 min, call again: new `bornAt` | Build the app inside the handler: every request pays the init cost |
| `connection-reuse` | `api/src/lambda.ts` | AWS SDK clients are created at module level (M2) and reused by warm invocations | Create a client per request: extra TLS handshakes, slower p99 |
| `correlation-id` | `api/src/plugins/correlation-id.ts` | `curl -H 'x-correlation-id: abc' .../api/health -i` → same header back; search logs for `abc` | Remove the header validation: a caller can inject newlines into logs |
| `cors` | `api/src/plugins/cors.ts`, `infra/http-api.ts` | Local only: preflight from `http://localhost:3001` gets `access-control-allow-origin` | Set `origin: "*"` with `credentials: true`: browsers refuse it, and it would be unsafe anyway |
| `cost-safety` | `infra/config.ts`, `infra/node-function.ts`, `infra/Pulumi.dev.yaml` | Every paid service is behind a flag that defaults to `false`; log groups keep 7 days | Let Lambda create its own log group: logs are kept (and billed) forever |
| `distributed-tracing` | `api/src/plugins/correlation-id.ts`, `infra/node-function.ts` | X-Ray console → Traces: each Lambda call with its AWS SDK calls | Turn `tracingConfig` off: no service map |
| `encryption-at-rest` | `infra/storage.ts` | S3 console → bucket → Properties → Default encryption: SSE-S3 | (Can't be turned off for new S3 objects since 2023) |
| `error-handling` | `api/src/plugins/error-handler.ts`, `api/src/errors.ts` | `curl .../api/nope` → `application/problem+json` with `correlationId` | Return `error.message` in the 500 branch: internals (table names) leak |
| `fail-fast` | `api/src/config.ts` | `STAGE= LOG_LEVEL=loud pnpm --filter @ticketlite/api dev` → crashes at startup with a clear Zod error | Read `process.env` inside handlers: typos fail on a random request, later |
| `lambda-versions` | `infra/lambdas.ts` | Lambda console → Aliases → `live` points at a numbered version | Point API Gateway at `$LATEST`: no rollback target, no canary |
| `least-privilege` | `infra/iam.ts`, `infra/node-function.ts` | IAM console → each function's role has only logs, X-Ray and its own inline policy | Attach `AdministratorAccess` to a function role |
| `origin-access-control` | `infra/cdn.ts` | `curl https://<bucket>.s3.amazonaws.com/index.html` → 403; via CloudFront → 200 | Remove the `AWS:SourceArn` condition: any distribution could read the bucket |
| `s3-security` | `infra/storage.ts` | S3 console → Permissions → "Block all public access: On" | Turn off `blockPublicPolicy` and add a `Principal: "*"` policy |
| `same-origin` | `api/src/config.ts`, `infra/cdn.ts` | Web and API share the CloudFront domain: no CORS preflight in the browser's network tab | Call the `execute-api` URL from the browser: CORS errors, and the cookie isn't first-party |
| `security-headers` | `infra/cdn.ts` | `curl -I $CLOUDFRONT/` → `strict-transport-security`, `content-security-policy`, `x-frame-options` | Remove the response headers policy: the site can be framed (clickjacking) |
| `structured-logging` | `api/src/app.ts` | CloudWatch Logs Insights: `fields correlationId, res.statusCode \| filter res.statusCode >= 500` | Log with string concatenation: fields can't be queried |
| `throttling` | `infra/http-api.ts` | Fire > 40 requests at once: API Gateway answers 429 before Lambda runs | Remove `defaultRouteSettings`: one script can run up the bill |
| `timeout-chain` | `infra/lambdas.ts`, `infra/node-function.ts`, `infra/http-api.ts` | API Gateway 29s > Lambda 10s > SDK calls (M2) | Make the Lambda timeout 60s: API Gateway gives up first and the user sees a 503 while Lambda keeps running (and billing) |
| `xss` | `infra/cdn.ts` | The CSP blocks scripts from other origins (browser console shows a CSP violation) | Add `script-src *`: injected third-party scripts would run |
| `schema-validation` | `packages/shared/src/event.ts` | `pnpm --filter @ticketlite/shared test` | Remove `.nonnegative()` from `price`; the "rejects a negative price" test fails |
| `optimistic-locking` | `packages/shared/src/event.ts` | Added in M3 (admin edits) | — |
| `pagination` | `packages/shared/src/pagination.ts` | Added in M2 (events list) | — |
