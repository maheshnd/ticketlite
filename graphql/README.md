# graphql

The AppSync GraphQL API: `schema.graphql` + one JS resolver per file in `resolvers/` (TypeScript, bundled by
esbuild into `dist/`, which `infra/appsync.ts` uploads).

| File | Field | Data source | Notes |
|---|---|---|---|
| `query-events.ts` | `Query.events` | DynamoDB (Events) | `byCity` or `byStatus` index, `nextToken` pagination |
| `query-event.ts` | `Query.event` | DynamoDB (Events) | Drafts return `null` |
| `query-my-bookings.ts` | `Query.myBookings` | DynamoDB (Bookings) | User id from the token (`ctx.identity.sub`) |
| `pipeline.ts` + `fn-check-admin.ts` + `fn-create-event.ts` / `fn-update-event.ts` | `Mutation.createEvent` / `updateEvent` | NONE, then DynamoDB | Pipeline: admin check, then write (optimistic locking) |
| `mutation-publish-seat-update.ts` | `Mutation.publishSeatUpdate` | NONE | IAM only; triggers `onSeatUpdate` |
| `field-event-organizer.ts` | `Event.organizer` | Lambda (BatchInvoke) | The N+1 fix |

```bash
pnpm --filter @ticketlite/graphql test       # resolver logic, @aws-appsync/utils faked
pnpm --filter @ticketlite/graphql build      # -> dist/*.js
AWS_PROFILE=ticketlite pnpm --filter @ticketlite/graphql evaluate   # run every resolver in the REAL APPSYNC_JS runtime (read-only API)
```

`appsync-builtins.graphql` declares AppSync's scalars and directives for standard tools (GraphQL Code Generator
in `web/`). AppSync defines them itself, so it is not deployed.

## Why both REST and GraphQL?

| Use | API | Why |
|---|---|---|
| Browsing events, organizer names, live seat counts | **AppSync (GraphQL)** | Clients ask for exactly the fields they need; subscriptions give real-time updates over managed WebSockets; JS resolvers read DynamoDB with no Lambda (no cold starts) |
| Login/refresh (HttpOnly cookie), bookings (idempotency, 202 + saga), uploads (presigned POST), partners (API keys + quotas) | **REST (Fastify + API Gateway)** | Cookie-based BFF auth, HTTP semantics (status codes, ETag, Cache-Control, CloudFront caching), simple command endpoints |

In this app the web uses REST for the list and detail (to show HTTP caching) and GraphQL for the organizer name and
the live seat count. The N+1 demo is best seen from the AppSync console or curl (below).

## The N+1 problem, live

```graphql
query { events(limit: 20) { items { name organizer { name } } } }
```

Without batching, AppSync would call the organizer resolver once per event (1 query + 20 lookups). With
`BatchInvoke` + `maxBatchSize: 20`, the Lambda logs show ONE invocation with `batchSize: 20`. Set `maxBatchSize`
to `0` in `infra/appsync.ts` and the 20 invocations come back.

## Security and cost notes

- **Auth modes:** Cognito (default), API key (public reads), IAM (backend only). Directives in the schema.
- **Query depth limit:** `queryDepthLimit: 5` rejects deeply nested (abusive) queries before any resolver runs.
  Complexity can also be capped with `resolverCountLimit`.
- **Introspection:** enabled in dev for tooling; a prod stack would set `introspectionConfig: "DISABLED"` (it hides
  the schema map from attackers, though it is not a security boundary by itself).
- **The API key is public** (it ships in the web app). It only grants the `@aws_api_key` fields. Protect it with
  WAF rate rules (`enableWaf`) and rotate it before it expires (max 365 days).
- **Caching:** AppSync server-side caching runs on a dedicated, always-on instance billed per hour, so it is off.
  Alternatives used here: React Query (client), CloudFront (REST), and per-resolver logic.
