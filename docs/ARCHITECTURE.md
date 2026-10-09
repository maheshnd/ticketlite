# Architecture

TicketLite is a serverless web app on AWS. One CloudFront domain serves the static Next.js site and forwards
`/api/*` to an HTTP API in front of one Fastify Lambda ("Lambdalith"). Long-running or asynchronous work runs in
small single-purpose Lambdas: a Step Functions saga, queue and stream consumers. AppSync adds GraphQL reads and
real-time seat counts. Everything is defined in Pulumi (`infra/`) and deployed only by GitHub Actions.

Diagrams are Mermaid, so they render on GitHub and in VS Code (with a Mermaid preview extension).

## 1. Overview

```mermaid
flowchart TB
  user([Browser]) --> cf[CloudFront + WAF*]
  partner([Partner]) -- x-api-key --> rest[API Gateway REST API<br/>usage plan + quota]
  cf -- "/*" --> s3web[(S3: web)]
  cf -- "/posters/*" --> s3posters[(S3: posters)]
  cf -- "/api/*" --> http[API Gateway HTTP API<br/>JWT authorizer, throttling]
  http --> api[api Lambda<br/>Fastify, alias live]
  rest --> api
  user -- GraphQL + WebSocket --> appsync[AppSync]
  user -- presigned POST --> s3posters

  api --> ddb[(DynamoDB<br/>Events, Bookings, IdempotencyKeys,<br/>Sessions, Organizers)]
  api --> cognito[Cognito]
  api --> sfn[Step Functions<br/>booking saga]
  api --> redis[(Upstash Redis*)]
  api --> os[(OpenSearch*)]
  api --> bus{{EventBridge}}
  api --> aurora[(Aurora Serverless v2*<br/>Data API)]

  sfn --> steps[saga Lambdas] --> ddb
  steps -- publishSeatUpdate (IAM) --> appsync
  steps --> bus
  appsync --> ddb
  appsync --> orgLambda[organizer batch Lambda]

  bus --> sqs[SQS email-queue] --> email[email-worker] --> ses[SES]
  bus --> sns[SNS admin] --> adminMail([admin email])
  ddb -- Events stream --> indexer[search-indexer*] --> os
  ddb -- Bookings stream --> reporter[sql-reporter*] --> aurora
  s3posters -- ObjectCreated, async --> poster[poster-processor] --> ddb
```

`*` = behind a cost flag that defaults to `false` (`infra/Pulumi.dev.yaml`).

## 2. Request path

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant CF as CloudFront
  participant GW as HTTP API
  participant L as api Lambda (Fastify)
  participant D as DynamoDB
  B->>CF: GET /api/events/evt-003 (Authorization? x-correlation-id)
  Note over CF: /api/* behavior: no cache, forward headers/cookies<br/>(/api/events list: cached 30 s)
  CF->>GW: same request
  Note over GW: route match, throttling, JWT authorizer on protected routes
  GW->>L: payload v2 event (invoke alias "live")
  Note over L: app built at cold start · correlation id · Zod validation
  L->>D: GetItem (via Redis cache-aside if enabled)
  D-->>L: item
  L-->>GW: 200 + ETag + Cache-Control + x-correlation-id
  GW-->>CF: response
  CF-->>B: response + security headers (HSTS, CSP, ...)
```

Code: `infra/cdn.ts`, `infra/http-routes.ts`, `api/src/lambda.ts`, `api/src/app.ts`, `api/src/routes/events.ts`.

## 3. Authentication (BFF with Cognito)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (React)
  participant A as API (BFF)
  participant C as Cognito
  B->>A: POST /api/auth/login {email, password}
  A->>C: InitiateAuth USER_PASSWORD_AUTH
  C-->>A: access token (15 min) + refresh token (7 days)
  A-->>B: body {accessToken} + Set-Cookie refresh_token (HttpOnly, Secure, SameSite=Strict, Path=/api/auth)
  Note over B: access token kept in memory only
  B->>A: GET /api/me (Authorization: Bearer access)
  Note over A: API Gateway JWT authorizer + aws-jwt-verify in Fastify
  A-->>B: {userId, email, groups}
  Note over B: page reload: memory is empty
  B->>A: POST /api/auth/refresh (cookie + x-csrf: 1)
  A->>C: InitiateAuth REFRESH_TOKEN_AUTH
  A-->>B: new access token
  B->>A: POST /api/auth/logout (cookie + x-csrf: 1)
  A->>C: RevokeToken
  A-->>B: 204 + cookie cleared
```

The **authorization code + PKCE** demo (`/api/auth/oauth/start` → Cognito managed login → `/api/auth/oauth/callback`)
ends in the same refresh cookie. The **session demo** (`/api/demo/session/*`) stores sessions in DynamoDB instead.
Code: `api/src/routes/auth.ts`, `oauth.ts`, `demo-session.ts`, `web/src/lib/api-client.ts`, `infra/cognito.ts`.

## 4. Booking saga

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant I as IdempotencyKeys
  participant SF as Step Functions
  participant R as ReserveSeat
  participant P as ProcessPayment
  participant C as ConfirmBooking
  participant X as ReleaseSeat
  B->>A: POST /api/bookings (Idempotency-Key)
  A->>I: claim key (conditional put)
  A->>A: rate limit (Redis*), early seat check, booking PENDING
  A->>SF: StartExecution(name = bookingId)
  A-->>B: 202 + Location
  loop every second until final
    B->>A: GET /api/bookings/:id
  end
  SF->>R: seats − n + seatReservedAt (one transaction)
  SF->>P: charge (retries with backoff, circuit breaker)
  alt paid
    SF->>C: CONFIRMED → EventBridge BookingConfirmed + AppSync seat update
  else declined / provider down
    SF->>X: compensation: seats + n, FAILED → BookingFailed + seat update
  end
```

State machine: [infra/booking-state-machine.md](../infra/booking-state-machine.md) (diagram + every state).
ADRs: [0004 orchestration](adr/0004-saga-orchestration.md), [0005 Standard workflow](adr/0005-standard-workflow.md).

## 5. Event-driven flow

See [EVENT-DRIVEN.md](EVENT-DRIVEN.md): EventBridge → SQS (+DLQ) → email-worker → SES; EventBridge → SNS fan-out;
S3 → poster-processor (async, on-failure queue); DynamoDB streams → indexer/reporter.

## 6. Search (CQRS)

```mermaid
flowchart LR
  admin([Admin edit]) --> api[API] --> ddb[(Events table<br/>write model)]
  ddb -- stream, in order --> idx[search-indexer] --> os[(OpenSearch index<br/>read model)]
  user([Search box]) --> api2[GET /api/search] --> os
  api2 -. enableSearch off .-> ddb
```

Details: [SEARCH.md](SEARCH.md).

## 7. Real-time seat updates

```mermaid
sequenceDiagram
  participant V as Visitor (event page)
  participant AS as AppSync
  participant S as Saga Lambda
  V->>AS: WebSocket connect (?header=base64{host, x-api-key})
  AS-->>V: connection_ack
  V->>AS: start: subscription onSeatUpdate(eventId)
  AS-->>V: start_ack
  S->>AS: mutation publishSeatUpdate (SigV4, IAM)
  AS-->>V: data {eventId, availableSeats}
  Note over V: setQueryData → the seat count re-renders, aria-live announces it
```

Code: `graphql/schema.graphql`, `functions/shared/appsync.ts`, `web/src/lib/appsync-realtime.ts`,
`web/src/features/events/live-seats.ts`. ADR: [0006 GraphQL client](adr/0006-graphql-client.md).

## 8. CI/CD

```mermaid
flowchart LR
  pr([Pull request]) --> ci[ci.yml: format · lint · typecheck · unit tests + coverage · build]
  ci --> e2e[Playwright + axe on the mock-mode build]
  e2e --> preview[pulumi preview, read-only OIDC role → PR comment]
  merge([Merge to main]) --> deploy[deploy.yml: tests · build · pulumi up, deploy role]
  deploy --> upload[S3 sync with cache headers] --> inval[CloudFront invalidation] --> smoke[Playwright smoke tests via CloudFront]
  manual([Manual]) --> destroy[destroy.yml, type 'destroy'] & seed[seed.yml]
```

No AWS keys exist anywhere: GitHub's OIDC token is exchanged for short-lived role credentials
(`bootstrap/`, [CICD-SETUP.md](CICD-SETUP.md)).

## 9. Code layout

| Layer | Folder | Rule |
|---|---|---|
| Shared contracts | `packages/shared` | Zod schemas = runtime validation + TypeScript types, used by API and web |
| HTTP | `api/src/routes` | Parse/validate, call a service, set status and headers |
| Logic | `api/src/services` | No HTTP, no AWS SDK |
| Data | `api/src/repositories` | One file per table, access patterns listed at the top |
| AWS clients | `api/src/lib`, `functions/shared` | Created once per cold start, short timeouts |
| Async workers | `functions/<name>` | One job each, README with trigger, retries, failure destination, IAM |
| Infra | `infra/<area>.ts` | One file per service area; `index.ts` only wires and exports |
