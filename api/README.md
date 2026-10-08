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
