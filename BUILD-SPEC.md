# TicketLite — Full Build Specification

> **For Claude Code.** This file is the single source of truth for building TicketLite end to end.
> Read it fully before planning. Also read `CLAUDE.md`. Build exactly what is described here.

## Table of contents

0. [How to work](#0-how-to-work)
1. [Product](#1-product)
2. [Repository structure](#2-repository-structure)
3. [Tech stack](#3-tech-stack)
4. [Data model (DynamoDB)](#4-data-model-dynamodb)
5. [REST API (Fastify on Lambda)](#5-rest-api-fastify-on-lambda)
6. [Authentication and authorization](#6-authentication-and-authorization)
7. [Booking flow (Step Functions saga)](#7-booking-flow-step-functions-saga)
8. [GraphQL (AppSync)](#8-graphql-appsync)
9. [Event-driven processing](#9-event-driven-processing)
10. [Search (OpenSearch)](#10-search-opensearch)
11. [Caching and rate limiting](#11-caching-and-rate-limiting)
12. [Optional SQL reporting (Aurora + Drizzle)](#12-optional-sql-reporting-aurora--drizzle)
13. [Frontend (Next.js + React Query)](#13-frontend-nextjs--react-query)
14. [Infrastructure (Pulumi)](#14-infrastructure-pulumi)
15. [Security](#15-security)
16. [Observability](#16-observability)
17. [CI/CD (GitHub Actions)](#17-cicd-github-actions)
18. [Testing](#18-testing)
19. [Documentation deliverables](#19-documentation-deliverables)
20. [Milestones](#20-milestones)
21. [Final report](#21-final-report)

---

## 0. How to work

### Purpose

TicketLite is a **learning project** for a lead engineer preparing for interviews on AWS serverless, GraphQL/AppSync, OpenSearch, Next.js, React Query, testing and CI/CD. The owner will read **every file** afterwards. Readability beats cleverness everywhere.

### Placeholders to use

- GitHub repo: `maheshnd/https://github.com/maheshnd/ticketlite`
- Alarm email: `mahesh.deshmukh.tech@gmail.com`
- SES verified sender/recipient email: `mahesh.deshmukh.tech@gmail.com`

### Rules

1. **Simplicity first.** One job per file. Short files (aim under ~150 lines). Flat, feature-based folders. No DI frameworks, no deep inheritance, no clever generic abstractions.
2. **Comment the WHY.** Every file starts with a 2–4 line header comment: what this file is, why it exists, which AWS service/concept it demonstrates. Inside, short step comments (`// Step 1: ...`) explaining why, not just what.
3. **Concept tags.** Wherever a key concept appears, add a comment tag so it can be found with search: `// CONCEPT: idempotency`, `// CONCEPT: cold-start`, `// CONCEPT: optimistic-locking`, etc. List every tag used in `docs/CONCEPT-MAP.md`.
4. **TypeScript strict** everywhere. **pnpm** workspaces only.
5. **Current versions.** Check and use current stable versions of every library, GitHub Action, Lambda runtime and Pulumi AWS provider API. Do not rely on memory for versions or APIs. Record anything surprising in `CLAUDE.md`.
6. **Deploys only via CI.** NEVER run `pulumi up` or `pulumi destroy`. `AWS_PROFILE=ticketlite pulumi preview` is allowed. `bootstrap/` is the one exception and is run by the owner, not you.
7. **No secrets in code, env vars, or git.** Secrets go in AWS Secrets Manager.
8. **Cost safety.** Paid or always-on services sit behind Pulumi config flags that default to `false` (see §14). Log groups have 7-day retention. Throttling limits are low.
9. **Work in milestones** (§20). After each milestone: typecheck, lint, run tests, run `pulumi preview`, update docs, commit with message `M<n>: <summary>`, and update `PROGRESS.md`.
10. **`PROGRESS.md`** at the repo root: milestones done, current milestone, next steps, open questions. If a session ends, the next session continues from it.
11. **When something in this spec is impossible or outdated** (an API changed, a service is unavailable), choose the closest correct current approach, note it in `PROGRESS.md` and the relevant ADR, and continue. Ask only if truly blocked.
12. **Existing code.** The repo already has `api/`, `infra/` (Lambda + HTTP API), `CLAUDE.md`, and possibly `bootstrap/` and `.github/workflows/`. Reuse and refactor them to fit this spec; do not duplicate.

---

## 1. Product

**TicketLite**: users browse events, search them, book seats, and get confirmation emails. Admins create events and upload posters. Partners read events through a keyed API.

| Role | Can do |
|---|---|
| Visitor (not logged in) | Browse events, view event detail with **live seat count**, search events |
| User (logged in) | Everything above + book seats, see "My bookings", see booking status live |
| Admin (Cognito group `admin`) | Create and edit events (with optimistic locking), upload posters, view SQL reports (if enabled) |
| Partner | `GET` events through a separate REST API using an API key with a usage plan and daily quota |

---

## 2. Repository structure

Keep the existing top-level names. Convert to a **pnpm workspace** at the root.

```
ticketlite/
  CLAUDE.md                → rules + context for every Claude Code session
  PROGRESS.md              → build progress
  BUILD-SPEC.md            → this file
  SERVICE-MAP.md           → AWS service → files → why
  README.md                → what this is, how to run, how to deploy
  pnpm-workspace.yaml
  docker-compose.yml       → local Redis + OpenSearch
  packages/
    shared/                → Zod schemas + TS types shared by api, functions, web
  api/                     → Fastify REST API (one Lambda, "Lambdalith")
  functions/               → small single-job Lambdas (one folder each)
  web/                     → Next.js frontend (static export)
  graphql/                 → schema.graphql + AppSync JS resolvers
  infra/                   → Pulumi program (one file per service area)
  bootstrap/               → one-time Pulumi stack: GitHub OIDC + CI roles
  e2e/                     → Playwright tests
  docs/                    → architecture, concept map, ADRs, runbook, learning path
  .github/workflows/       → CI/CD
```

### `api/` layout (layered, but simple)

```
api/src/
  app.ts            → buildApp(): registers plugins + routes
  lambda.ts         → Lambda entry (adapter), app built OUTSIDE handler
  local.ts          → local entry (port 3000)
  config.ts         → reads env vars once, typed
  plugins/          → request-id/correlation, error handler, auth context, rate-limit, swagger
  routes/           → one file per feature: events, bookings, auth, uploads, search, admin, partner, health, demo-session
  services/         → business logic per feature (no AWS SDK calls here directly)
  repositories/     → DynamoDB access per table (CONCEPT: repository pattern)
  lib/              → AWS clients (DynamoDB, Step Functions, S3, Cognito, Secrets), redis, opensearch
```

Rule of thumb: **routes** handle HTTP, **services** hold logic, **repositories** talk to the database. Each layer is thin.

### `functions/` layout

One folder per function, each with `handler.ts` and a short `README.md` (trigger, invocation type, retries, failure destination, IAM permissions):

```
functions/
  booking-reserve-seat/      → saga step
  booking-process-payment/   → saga step (fake payment)
  booking-confirm/           → saga step
  booking-release-seat/      → saga compensation
  email-worker/              → SQS consumer → SES
  search-indexer/            → DynamoDB Stream → OpenSearch
  poster-processor/          → S3 event (async) → validate + update event
  appsync-organizer-batch/   → AppSync Lambda resolver (BatchInvoke, N+1 fix)
  sql-reporter/              → (optional) Bookings stream → Aurora via Drizzle
  shared/                    → tiny helpers: powertools setup, clients
```

---

## 3. Tech stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict) |
| Package manager | pnpm workspaces |
| Lambda runtime | Latest Node.js LTS runtime Lambda supports; arm64 |
| Bundling | esbuild (one bundle per Lambda) |
| API framework | Fastify + `@fastify/aws-lambda` + Zod type provider + `@fastify/swagger` |
| Validation | Zod (shared schemas in `packages/shared`) |
| Lambda utilities | Powertools for AWS Lambda (TypeScript): Logger, Tracer, Metrics, Parameters, Idempotency only if it stays simple |
| AWS SDK | AWS SDK for JavaScript v3 (modular clients) |
| Database | DynamoDB (on-demand) |
| Cache | Redis via `ioredis` (Upstash in cloud, Docker locally) |
| Search | OpenSearch (managed domain in cloud behind flag, Docker locally) |
| GraphQL | AWS AppSync, JS resolvers (APPSYNC_JS runtime) + one Lambda resolver |
| Workflow | AWS Step Functions (Standard) |
| Events/messaging | EventBridge (custom bus), SQS (+DLQ), SNS |
| Email | Amazon SES (sandbox: verified `<SES_EMAIL>` only) |
| Auth | Amazon Cognito User Pool + groups |
| Frontend | Next.js (App Router, static export), React, TanStack Query (React Query), Tailwind CSS |
| GraphQL client | Use the current recommended lightweight approach for AppSync queries + real-time subscriptions that lets us pass our own Cognito access token. Document the choice in an ADR. |
| GraphQL types | GraphQL Code Generator for typed operations in `web/` |
| IaC | Pulumi (TypeScript) |
| CI/CD | GitHub Actions + OIDC |
| Tests | Vitest, React Testing Library, MSW, Playwright, `@axe-core/playwright` |
| Lint/format | ESLint (flat config, incl. `jsx-a11y`) + Prettier |
| Optional SQL | Aurora Serverless v2 PostgreSQL (Data API) + Drizzle ORM |

---

## 4. Data model (DynamoDB)

Use **separate tables** (clearer for learning). Write an ADR comparing this with **single-table design** and explaining when a team would choose it.

### `Events`

- PK: `eventId` (string)
- Attributes: `name`, `description`, `city`, `venue`, `startsAt` (ISO), `price`, `totalSeats`, `availableSeats`, `posterKey`, `organizerId`, `status` (`DRAFT|PUBLISHED`), `version` (number), `createdAt`, `updatedAt`
- GSI `byCity`: PK `city`, SK `startsAt` → "events in Pune, soonest first"
- Stream: `NEW_AND_OLD_IMAGES` (feeds search-indexer)

### `Bookings`

- PK: `bookingId`
- Attributes: `userId`, `eventId`, `seats`, `amount`, `status` (`PENDING|CONFIRMED|FAILED|CANCELLED`), `failureReason`, `executionArn`, `createdAt`, `updatedAt`
- GSI `byUser`: PK `userId`, SK `createdAt` → "my bookings, newest first"
- GSI `byEvent`: PK `eventId`, SK `createdAt`
- Stream: `NEW_IMAGE` (feeds optional sql-reporter)

### `IdempotencyKeys`

- PK: `key` (`<userId>#<Idempotency-Key header>`)
- Attributes: `status`, `responseBody`, `responseStatus`, `expiresAt`
- **TTL** on `expiresAt` (24h)

### `Sessions` (learning demo only)

- PK: `sessionId`, attributes `userId`, `expiresAt`, **TTL** on `expiresAt`

### Organizers

- Small seeded list (can be a table `Organizers` with PK `organizerId`) used to demonstrate the GraphQL N+1 problem.

### Concepts to demonstrate (with `CONCEPT:` tags)

- Access patterns written at the top of each repository file
- `Query` vs `Scan` (never scan in request paths; one commented example of why)
- **Conditional writes** (seat can't go below 0)
- **TransactWriteItems** (reserve seat + create booking atomically)
- **Optimistic locking** with `version` on admin event edits → HTTP 409 on conflict
- **Pagination** with `LastEvaluatedKey` → opaque base64 cursor
- **Strongly vs eventually consistent reads** (one example of each, with a comment)
- **TTL**
- A `scripts/seed.ts` that inserts sample events and organizers (run by the owner or via a manual workflow)

---

## 5. REST API (Fastify on Lambda)

### Routes

All REST routes live under `/api`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Health check |
| GET | `/api/events` | none | List published events, filter `?city=`, cursor pagination |
| GET | `/api/events/:id` | none | Event detail (cache-aside via Redis) |
| GET | `/api/search?q=` | none | Full-text search (OpenSearch, or DynamoDB fallback when disabled) |
| POST | `/api/auth/signup` | none | Cognito sign up |
| POST | `/api/auth/confirm` | none | Confirm with email code |
| POST | `/api/auth/login` | none | Login → access token in body, refresh token in HttpOnly cookie |
| POST | `/api/auth/refresh` | cookie | New access token from refresh cookie (CSRF-protected) |
| POST | `/api/auth/logout` | cookie | Revoke refresh token, clear cookie |
| POST | `/api/auth/forgot` / `/api/auth/reset` | none | Password reset |
| GET | `/api/auth/oauth/start` and `/api/auth/oauth/callback` | none | Cognito managed login, **authorization code + PKCE** demo |
| GET | `/api/me` | JWT | Current user + groups |
| POST | `/api/bookings` | JWT | Start booking (requires `Idempotency-Key` header) → 202 + `bookingId` |
| GET | `/api/bookings/:id` | JWT | Booking status (owner only) |
| GET | `/api/bookings` | JWT | My bookings (cursor pagination) |
| POST | `/api/admin/events` | JWT + admin | Create event |
| PUT | `/api/admin/events/:id` | JWT + admin | Update event (optimistic locking) |
| POST | `/api/admin/uploads/poster` | JWT + admin | Presigned **POST** for S3 (content-type + size limits) |
| GET | `/api/admin/reports` | JWT + admin | SQL reports (only when SQL enabled) |
| POST | `/api/demo/session/login`, GET `/api/demo/session/me` | none | **Session-based auth demo** (DynamoDB Sessions table, cookie `sid`) for comparing with JWT |
| GET | `/partner/events` | API key (REST API) | Partner read API |

### Patterns to implement

- **Correlation ID**: read `x-correlation-id` or generate one; attach to every log line; pass it into Step Functions input and EventBridge event detail; return it in the response header.
- **Errors**: one error handler returning RFC 9457 problem details (`application/problem+json`). Known errors map to 400/401/403/404/409/429; unknown → 500 without leaking internals.
- **Validation**: Zod schemas from `packages/shared` for body, params, query and responses.
- **Idempotency** on `POST /api/bookings` using the `IdempotencyKeys` table: same key + same user → return stored response; same key in progress → 409.
- **OpenAPI** docs at `/api/docs` (only when `STAGE=dev`).
- **HTTP semantics**: correct status codes (201, 202, 204, 304 via ETag on `GET /api/events/:id`, 400, 401, 403, 404, 409, 422 if used, 429), `Cache-Control` headers on public GETs.
- **Graceful handling** of Lambda timeouts: downstream calls have their own shorter timeouts (CONCEPT: timeout-chain).
- Module-level clients created outside the handler (CONCEPT: cold-start, connection-reuse).
- Keep the `/api/copy-info` cold-start demo route.

---

## 6. Authentication and authorization

### Design (document as a sequence diagram)

- **Cognito User Pool**: email sign-in, email verification, password policy, group `admin`.
- **App client** for the backend (BFF) with the auth flows needed for the custom UI, plus managed login configured for the **authorization code + PKCE** demo.
- **BFF pattern** in Fastify:
  - Login returns the **access token in the response body** (frontend keeps it **in memory only**, never localStorage).
  - The **refresh token** goes in a cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`.
  - `POST /api/auth/refresh` requires a custom header (e.g. `x-csrf: 1`) in addition to SameSite (CONCEPT: csrf).
  - Logout revokes the refresh token in Cognito and clears the cookie.
- **Same origin**: CloudFront serves the web app and routes `/api/*` to API Gateway, so cookies are first-party and CORS is not needed in production (CONCEPT: same-origin). Keep a strict CORS config for local dev only.
- **API Gateway JWT authorizer** (Cognito issuer + audience) on protected routes, so unauthenticated requests never reach Lambda.
- **App-level authorization in Fastify**: admin routes check the `cognito:groups` claim (CONCEPT: rbac); booking reads check ownership (CONCEPT: authorization vs authentication).
- **Session demo** (§5) to contrast stateful sessions with stateless JWTs, including "how do you log out a JWT?" in the docs.

---

## 7. Booking flow (Step Functions saga)

1. `POST /api/bookings` (JWT, `Idempotency-Key`) → validate → **rate limit** per user (Redis) → create `PENDING` booking → start a **Standard** Step Functions execution → return **202** with `bookingId`.
2. State machine (defined in Pulumi, JSON/ASL readable with comments in a nearby `.md`):
   - `ReserveSeat` → DynamoDB **TransactWriteItems**: decrement `availableSeats` only if enough seats (condition), update booking.
   - `ProcessPayment` → fake provider: fails when the amount ends in `.13` or when config `paymentFailureRate` triggers; uses **retry with exponential backoff** on transient errors; a simple **circuit breaker** example (state in Redis or in-memory per copy, documented trade-off).
   - `ConfirmBooking` → status `CONFIRMED`, publish `BookingConfirmed` to EventBridge, call AppSync `publishSeatUpdate` (IAM auth, SigV4).
   - On payment failure → `ReleaseSeat` (compensation) → status `FAILED` → publish `BookingFailed` → `publishSeatUpdate`.
3. Frontend polls `GET /api/bookings/:id` with React Query `refetchInterval` until a final status, and the event page updates live through the subscription.

Concepts: saga, compensation, orchestration vs choreography (ADR), idempotent steps, retries/backoff, Standard vs Express workflows (ADR).

---

## 8. GraphQL (AppSync)

### Schema (`graphql/schema.graphql`)

- Types: `Event`, `Organizer`, `Booking`, `SeatUpdate`, `EventConnection` (cursor pagination)
- Queries: `events(city, limit, nextToken)`, `event(id)`, `myBookings(limit, nextToken)`
- Mutations: `createEvent` (admin), `updateEvent` (admin, optimistic locking), `publishSeatUpdate` (IAM only, backend use)
- Subscription: `onSeatUpdate(eventId)` subscribed to `publishSeatUpdate`
- `Event.organizer` field resolved through a **Lambda resolver with BatchInvoke** to demonstrate and fix **N+1**

### Auth modes

- Default: **Cognito User Pools**
- Additional: **API key** for public read queries (`events`, `event`, `onSeatUpdate`)
- Additional: **IAM** for backend-only `publishSeatUpdate`
- Use schema directives to show which mode each field allows.

### Resolvers

- JS resolvers (APPSYNC_JS) direct to DynamoDB for simple reads (no Lambda = cheaper, faster)
- **Pipeline resolver** for `createEvent`/`updateEvent`: step 1 checks the `admin` group, step 2 writes
- `NONE` data source for `publishSeatUpdate` (local resolver that just triggers subscriptions)
- One Lambda resolver (organizer batch)

### Documentation to include

- REST vs GraphQL in this app (why both exist): AppSync for read-heavy browsing and real-time; REST for the auth cookie flow, booking commands, uploads and the partner API.
- Query depth/complexity, security (introspection off in prod note), caching options (AppSync caching is paid; documented, off).

---

## 9. Event-driven processing

- **EventBridge custom bus** `ticketlite`: events `BookingConfirmed`, `BookingFailed`, `EventCreated`.
- **Rules**:
  - `BookingConfirmed` → **SQS** `email-queue` → `email-worker` (poll-based, batch size small, **partial batch response**, idempotent via "email-sent" marker, **DLQ** after N receives, visibility timeout > function timeout).
  - `BookingConfirmed` and `BookingFailed` → **SNS** topic `admin-notifications` (fan-out; email subscription `<ALERT_EMAIL>`).
- **S3 poster upload** → `poster-processor` (**asynchronous** invocation: validates type/size, updates the event's `posterKey`; **on-failure destination** to an SQS queue).
- **DynamoDB Stream** on `Events` → `search-indexer` (poll-based, in-order, `bisectBatchOnFunctionError`, max retries, on-failure destination).
- Document a table: **SQS vs SNS vs EventBridge vs Streams vs Kinesis** — when to use each, with where each appears in this app.
- A `docs/runbook` section: how to inspect a DLQ and redrive messages.

---

## 10. Search (OpenSearch)

- **Local**: OpenSearch in `docker-compose.yml`.
- **Cloud**: managed OpenSearch domain, smallest dev instance, single node, encryption at rest + in transit, IAM-based access; Lambdas sign requests with SigV4. **Behind flag `enableSearch` (default false).**
- Index `events` with an explicit **mapping** (text vs keyword fields, a custom analyzer for names, date field).
- `search-indexer` upserts/deletes documents from the stream (CONCEPT: cqrs, eventual-consistency).
- `GET /api/search`: multi-match query with fuzziness, filter by city, sort by date, plus one **aggregation** (events per city).
- When `enableSearch` is false: fall back to the DynamoDB `byCity` query and say so in the response metadata.
- Docs: shards, replicas, index vs document, inverted index, mappings, analyzers, relevance scoring, scaling, why search is a separate read model.

---

## 11. Caching and rate limiting

- **Redis** (`ioredis`): Upstash in cloud (connection URL in Secrets Manager), Docker locally. **Behind flag `enableCache` (default false).** When disabled, use a **no-op cache** with the same interface (CONCEPT: null-object).
- **Cache-aside** for `GET /api/events/:id` with TTL; **invalidate** on admin update.
- **Cache stampede protection**: short lock key so only one request rebuilds the cache.
- **Rate limiting**: sliding window per user on `POST /api/bookings` → 429 with `Retry-After`.
- **CloudFront caching**: long-lived immutable cache for static assets, short TTL for HTML, **30s cache for `GET /api/events`** (cache policy including query strings), no caching for authenticated routes.
- **API Gateway throttling**: stage defaults + a lower limit on the bookings route.
- Docs: cache-aside vs read-through vs write-through vs write-behind, TTL, LRU, invalidation, stampede, ElastiCache vs Upstash (VPC, NAT cost), where each cache layer sits.

---

## 12. Optional SQL reporting (Aurora + Drizzle)

**Behind flag `enableSql` (default false).**

- Aurora Serverless v2 PostgreSQL with the **Data API** enabled and **minimum capacity as low as currently supported** (scale to zero if available). Verify current support before building; if unavailable, document the closest option.
- `sql-reporter`: Bookings stream → upsert into Postgres via **Drizzle ORM** (Data API driver).
- Drizzle schema + migrations in `functions/sql-reporter/` (or `packages/sql/`).
- `GET /api/admin/reports`: SQL aggregation (revenue per event, bookings per day) with a JOIN.
- ADR: SQL vs NoSQL in this app, Data API vs RDS Proxy vs direct connections, connection pooling, why Lambda + SQL needs care.

---

## 13. Frontend (Next.js + React Query)

### Hosting

- **Static export** (`output: "export"`) uploaded to S3, served by CloudFront with **Origin Access Control**.
- Because of static export, use routes like `/event?id=...` for dynamic items (or another documented approach that works with static export).
- ADR: static export vs SSR/ISR on AWS (Amplify Hosting, OpenNext) — trade-offs for a high-traffic B2C portal.

### Pages

| Page | Notes |
|---|---|
| `/` | Events list, city filter, infinite scroll (`useInfiniteQuery`) |
| `/search` | Search box with debounced query, results, city aggregation |
| `/event?id=` | Detail, poster, price, **live seat count** (subscription updates React Query cache), Book button |
| `/booking?id=` | Booking status with polling until final state |
| `/bookings` | My bookings (protected) |
| `/login`, `/signup`, `/confirm`, `/forgot`, `/reset` | Auth forms with accessible validation errors |
| `/admin/events`, `/admin/events/new`, `/admin/events/edit?id=` | Admin CRUD + poster upload (presigned POST) + 409 conflict handling |
| `/admin/reports` | Only when SQL enabled |
| `/learn` | Simple page listing the architecture diagram link and concept map (handy for demos) |

### React Query patterns (each with a `CONCEPT:` tag)

- One `QueryClient` with sensible defaults (`staleTime`, `retry` rules: no retry on 4xx)
- **Query key factory** per feature
- `useQuery`, `useInfiniteQuery`, `useMutation`
- **Optimistic update** (example: admin toggling event status) with rollback on error
- **Cache invalidation** after mutations
- **Prefetch** on hover for event detail
- Subscription events written into the cache with `setQueryData`
- Polling with `refetchInterval` that stops on final status
- Global and per-page **error boundaries** and loading states

### Auth on the client

- Access token kept **in memory** in an auth context; on page load call `/api/auth/refresh` to restore the session.
- One small fetch wrapper: attaches the token, on 401 refreshes once and retries, sends `x-correlation-id`.

### Quality

- **Accessibility first**: semantic HTML, labels, focus management on route change and in dialogs, keyboard support, visible focus, colour contrast, `aria-live` for live seat updates and booking status.
- **Performance**: code splitting, lazy-loading admin, image sizing, font loading, minimal client JS on the list page; document Core Web Vitals and how to measure them.
- Responsive, mobile-first layout with Tailwind.

---

## 14. Infrastructure (Pulumi)

### Files (`infra/`)

```
index.ts            → wires modules, exports outputs
config.ts           → reads stack config + flags, typed
iam.ts              → per-function least-privilege roles (helper kept simple)
dynamodb.ts         → tables, GSIs, streams, TTL
cognito.ts          → user pool, groups, app clients, managed login domain
lambdas.ts          → api Lambda + all functions (or split per area if long)
http-api.ts         → HTTP API, routes, JWT authorizer, stage, throttling
partner-api.ts      → REST API, API key, usage plan + quota
appsync.ts          → GraphQL API, auth modes, data sources, resolvers
stepfunctions.ts    → booking state machine
events.ts           → EventBridge bus + rules, SQS + DLQs, SNS
storage.ts          → S3 buckets (web, posters) with block public access
cdn.ts              → CloudFront: S3 + API origins, behaviors, cache + response-header policies
secrets.ts          → Secrets Manager secrets (values set manually, never in code)
search.ts           → OpenSearch domain (flag)
sql.ts              → Aurora + Data API (flag)
waf.ts              → WAF web ACL on CloudFront (flag)
observability.ts    → alarms, dashboard, alarm SNS topic
```

### Config flags (in `Pulumi.dev.yaml`, all default false)

| Flag | Turns on | Why off by default |
|---|---|---|
| `enableSearch` | OpenSearch domain | Hourly instance cost |
| `enableCache` | Redis (Upstash) usage | Needs an Upstash account + secret |
| `enableSql` | Aurora + sql-reporter | Cost, VPC complexity |
| `enableWaf` | WAF on CloudFront | Monthly ACL + rule cost |
| `enableCustomDomain` | ACM cert + domain on CloudFront | Needs DNS access |
| `enableProvisionedConcurrency` | Pre-warmed api Lambda | Paid when idle |
| `reservedConcurrency` | Reserved concurrency (number, default unset) | Accounts with low concurrency quotas reject it (unreserved must stay ≥ 100) |

### Other requirements

- Lambda: arm64, explicit memory/timeouts (inner timeouts shorter than outer), X-Ray active tracing, 7-day log groups, `dependsOn` logging policy.
- api Lambda publishes **versions** and uses an alias `live` (document how canary deploys would work).
- HTTP API: CORS only for local dev origin; JWT authorizer; explicit routes per auth type (public vs protected) all pointing to the same integration.
- Every resource tagged: `project=ticketlite`, `stage=<stack>`, `managedBy=pulumi`.
- Outputs: CloudFront URL, API URL, AppSync URL + API key, user pool IDs, bucket names, CloudFront distribution ID.

---

## 15. Security

- Least-privilege IAM per function (document each function's permissions in its README).
- S3: block public access, OAC only, presigned POST with conditions.
- CloudFront response headers policy: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
- Input validation everywhere (Zod), no raw string building for queries (document injection risks for NoSQL and SQL).
- Secrets Manager for Upstash URL and payment "provider" signing secret; read with caching (Powertools Parameters).
- Encryption at rest everywhere (default keys; ADR on AWS-owned vs customer-managed KMS keys).
- Doc `docs/SECURITY.md`: XSS, CSRF, CORS, SSRF, injection, token storage, OWASP top risks, and where this app handles each.

---

## 16. Observability

- Powertools Logger/Tracer/Metrics in all `functions/`; structured JSON logs with `correlationId`.
- Custom metrics: `BookingsStarted`, `BookingsConfirmed`, `BookingsFailed`, `PaymentFailures`.
- X-Ray tracing on Lambdas and Step Functions (note: HTTP API does not support X-Ray; document it).
- CloudWatch alarms → SNS `alarms` topic (email `<ALERT_EMAIL>`): api 5xx, Lambda errors, throttles, any DLQ depth > 0, Step Functions failures.
- One CloudWatch dashboard.
- `docs/RUNBOOK.md`: how to find a request by correlation ID, read traces, redrive a DLQ, roll back a deploy.

---

## 17. CI/CD (GitHub Actions)

If `bootstrap/` and workflows already exist, extend them; otherwise create them.

### `bootstrap/` (run once by the owner)

- GitHub OIDC provider, **preview role** (ReadOnlyAccess; trusted for `pull_request` on this repo), **deploy role** (AdministratorAccess with a comment on why and what a company would narrow it to; trusted only for `refs/heads/main`). Both check `aud`.

### Workflows

- `ci.yml` (pull requests): install, lint, typecheck, unit tests (api, functions, web, shared), build all, Playwright tests against local build with MSW, `pulumi preview` (preview role) with PR comment.
- `deploy.yml` (push to main + manual): install, build, `pulumi up` (deploy role), upload `web/out` to the web bucket with correct cache headers, CloudFront invalidation for HTML, then **post-deploy smoke tests** (Playwright) against the CloudFront URL.
- `destroy.yml` (manual, typed confirmation "destroy").
- `seed.yml` (manual) to run the seed script with the deploy role.
- `concurrency` groups, least `permissions`, current action versions, dependency caching.
- Document a future `prod` stack with a GitHub **environment** requiring approval.
- No AWS keys anywhere; only `PULUMI_ACCESS_TOKEN` as a secret; role ARNs as repository variables.

---

## 18. Testing

- **Unit** (Vitest): services, repositories (mock the AWS SDK with `aws-sdk-client-mock`), each function handler, shared schemas.
- **Component** (Vitest + React Testing Library + MSW): event list, booking button states, auth forms, live seat count.
- **E2E** (Playwright): visitor browses and searches; user signs up (mocked in local mode), books, sees status; admin creates event; **axe accessibility checks** on main pages.
- Tests written in a TDD-friendly style: small, named after behaviour (`it("returns 409 when the event version is stale")`).
- Coverage report in CI (no hard gate).

---

## 19. Documentation deliverables

All Markdown, readable in VS Code and GitHub. Use **Mermaid** for diagrams.

| File | Content |
|---|---|
| `README.md` | What TicketLite is, quick start (local), how deploy works, links to everything |
| `docs/ARCHITECTURE.md` | Overall architecture diagram + diagrams for: request path (CloudFront → API GW → Lambda → DynamoDB), auth flow (sequence), booking saga (sequence + state machine), event-driven flow, search CQRS flow, real-time subscription flow, CI/CD flow |
| `SERVICE-MAP.md` | Every AWS service → Pulumi file → app files → why we use it → config flag |
| `docs/CONCEPT-MAP.md` | Every concept (the 12 topics below + backend concepts + `CONCEPT:` tags) → exact files → "how to see it" → "how to break it" |
| `docs/LEARNING-PATH.md` | Study order matching the 12 topics, each with files to read and experiments to run |
| `docs/adr/NNNN-*.md` | Short ADRs (context, decision, alternatives, consequences) for every major choice |
| `docs/RUNBOOK.md` | Operations: logs, traces, DLQ redrive, rollback, cost checks |
| `docs/SECURITY.md` | As in §15 |
| `docs/COSTS.md` | What each service costs, what's free, what each flag turns on, how to destroy |
| `docs/CICD-SETUP.md` | One-time setup steps for the owner, in order |
| Per-folder `README.md` | What lives here and how to run/test it |

### The 12 learning topics `docs/CONCEPT-MAP.md` must cover

1. AWS Serverless Fundamentals — serverless vs traditional, core services, request flow
2. AWS Lambda — handlers, lifecycle, cold/warm starts, concurrency, scaling, memory, timeouts, layers, IAM, errors
3. Amazon API Gateway — HTTP vs REST, routes, integrations, auth, CORS, throttling, validation, custom domains
4. DynamoDB — partition/sort keys, GSIs, access patterns, queries, transactions, consistency, capacity
5. GraphQL — schema, types, queries, mutations, resolvers, subscriptions, REST comparison, N+1, security
6. AWS AppSync — data sources, pipeline resolvers, Lambda integration, authorization, real-time
7. OpenSearch — indexes, documents, mappings, analyzers, full-text search, aggregations, shards, replication, scaling
8. Event-driven serverless — SQS, SNS, EventBridge, Step Functions, DLQs, retries, idempotency, async workflows
9. Security and observability — IAM, Cognito, JWT, KMS, Secrets Manager, CloudWatch, tracing, alarms, cost controls
10. Infrastructure + CI/CD — Pulumi, deployments, environments, GitHub Actions, rollback, automated testing
11. Production system design — scaling, resilience, caching, failures, database design, performance, trade-offs
12. Technical lead topics — architecture decisions (point to ADRs), code review checklist (`docs/CODE-REVIEW.md`), mentoring notes on how this codebase is structured for onboarding

Also map these backend concepts: REST principles, HTTP methods + idempotency, status codes, ACID vs BASE, indexing, sessions vs JWT, OAuth/OIDC, RBAC vs ABAC, request lifecycle, caching patterns, repository/DI/middleware/factory patterns, SQL/NoSQL injection, CSRF, rate limiting algorithms, password hashing (handled by Cognito — explain), vertical vs horizontal scaling, replication/sharding/partitioning (DynamoDB partitions, OpenSearch shards), message queues and DLQs, monolith vs microservices (Lambdalith vs functions), distributed tracing, CAP theorem, N+1, connection pooling, eventual consistency/saga, event sourcing vs CQRS, normalization vs denormalization, safe migrations, graceful shutdown (and how it differs in Lambda), structured logging.

---

## 20. Milestones

Each milestone ends with: typecheck + lint + tests + `pulumi preview` + docs updated + commit + `PROGRESS.md` updated.

| # | Milestone | Done when |
|---|---|---|
| M0 | Workspace setup: pnpm workspace, `packages/shared`, ESLint/Prettier, Vitest, docker-compose, README skeleton, PROGRESS.md | Everything installs and typechecks |
| M1 | Refactor existing api/infra into the new structure; CloudFront + S3 + web skeleton; CI/CD (bootstrap, ci, deploy, destroy) | Preview passes; workflows valid |
| M2 | DynamoDB tables + repositories + seed; events REST routes; Cognito + BFF auth + JWT authorizer; session demo; web: list, detail, auth pages with React Query | Unit + component tests pass |
| M3 | Booking: idempotency, Step Functions saga, all saga Lambdas, booking pages, admin CRUD with optimistic locking, presigned poster upload + poster-processor | Tests pass; state machine previewed |
| M4 | AppSync: schema, auth modes, JS + pipeline resolvers, N+1 batch resolver, subscriptions wired to saga; web live seat count | Codegen + tests pass |
| M5 | Event-driven: EventBridge, SQS + DLQ email worker (SES), SNS, DynamoDB stream; search-indexer + OpenSearch (flag) + search page; Redis cache + rate limit (flag); CloudFront caching | Tests pass |
| M6 | Security + observability: Powertools, metrics, alarms, dashboard, response headers, WAF (flag), partner REST API with usage plan; optional SQL (flag) | Tests pass |
| M7 | Testing + docs completion: Playwright E2E + axe, all docs in §19, architecture diagrams, concept map, ADRs, learning path, final consistency pass | Every doc complete and accurate |

---

## 21. Final report

When all milestones are done, report:

1. Tree of the repo (2 levels)
2. What each milestone delivered
3. Test results and `pulumi preview` summary (resource count)
4. Every assumption, deviation from this spec, and anything uncertain
5. Exact next steps for the owner (bootstrap, secrets, GitHub variables, first deploy, seeding, how to enable each flag)