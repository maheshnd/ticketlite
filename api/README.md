# api

The TicketLite REST API: one Fastify app ("Lambdalith") that serves every `/api/*` route. It runs locally
as a normal server and inside Lambda through `@fastify/aws-lambda`.

| File / folder | Job |
|---|---|
| `src/app.ts` | `buildApp()`: registers plugins and routes (no server) |
| `src/lambda.ts` | Lambda entry: app built once per cold start, outside the handler |
| `src/local.ts` | Local entry on port 3000 |
| `src/config.ts` | Reads env vars once, typed and validated |
| `src/errors.ts` | `HttpError` + helpers (`notFound()`, `conflict()`, …) |
| `src/plugins/` | Correlation ID, problem+json error handler, local-only CORS, Swagger at `/api/docs` |
| `src/routes/` | HTTP only: parse, call a service, reply |
| `src/services/` | Business logic (no AWS SDK calls) |
| `src/repositories/` | DynamoDB access, one file per table |
| `src/lib/` | AWS SDK clients and other connections, created once |

Rule of thumb: **routes** handle HTTP, **services** hold logic, **repositories** talk to the database.

```bash
pnpm --filter @ticketlite/api dev     # http://localhost:3000/api/health, docs at /api/docs
pnpm --filter @ticketlite/api test    # app.inject(): in memory, no port, no AWS
pnpm --filter @ticketlite/api build   # dist/index.js (+ Swagger UI static files)
```

## Adding a route or an AWS call

- **A new route** → add it to `infra/http-route-list.ts` (public or protected). Otherwise API Gateway answers 404 in
  AWS while it works locally; `test/http-routes.test.ts` fails and names the route (ADR 0011).
- **A new AWS SDK call** → add the exact action + resource to `apiStatements` in `infra/lambdas.ts`, with a comment
  naming the file. Locally your own credentials hide a missing permission; deployed, it is AccessDenied.

## IAM permissions (`infra/lambdas.ts`, `apiStatements`)

| Code | Action | Resource |
|---|---|---|
| `repositories/events-repository.ts` | `dynamodb:GetItem`, `PutItem`, `UpdateItem` / `Query` | Events table / its indexes (`byStatus`, `byCity`) |
| `repositories/bookings-repository.ts` | `dynamodb:GetItem`, `PutItem`, `UpdateItem` / `Query` | Bookings table / its indexes (`byUser`) |
| `repositories/idempotency-repository.ts` | `dynamodb:GetItem`, `PutItem`, `DeleteItem` | IdempotencyKeys table |
| `repositories/sessions-repository.ts` | `dynamodb:GetItem`, `PutItem`, `DeleteItem` | Sessions table |
| `lib/stepfunctions.ts` | `states:StartExecution` | the booking state machine |
| `lib/eventbridge.ts` | `events:PutEvents` | the ticketlite bus |
| `lib/s3.ts` (presigned POST: S3 checks the signer's permission at upload time) | `s3:PutObject` | `posters/*` in the posters bucket |
| `lib/redis.ts` (flag `enableCache`) | `secretsmanager:GetSecretValue` | the Upstash Redis URL secret |
| `services/search-service.ts` (flag `enableSearch`) | `es:ESHttpPost`, `ESHttpGet` | `<domain>/events/_search` |
| `services/reports-service.ts` (flag `enableSql`) | `rds-data:ExecuteStatement` + `secretsmanager:GetSecretValue` | the Aurora cluster + its managed secret |

Cognito needs no permission: the api only calls public APIs authenticated by a password or token (`SignUp`,
`InitiateAuth`, `GetUser`, `RevokeToken`, …), never `Admin*`. Logs and X-Ray come from the two managed policies every
function gets (`infra/iam.ts`).
