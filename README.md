# TicketLite

A small ticket-booking app built to learn AWS serverless in depth, for lead-engineer interviews. Visitors browse and
search events with live seat counts; users sign up, book seats and get a confirmation email; admins create events and
upload posters; partners read events through a metered API.

It touches Lambda, API Gateway (HTTP + REST), DynamoDB, Cognito, Step Functions, AppSync (GraphQL + real-time),
EventBridge, SQS, SNS, SES, OpenSearch, S3, CloudFront, WAF, Secrets Manager, CloudWatch, X-Ray and Aurora, plus
Next.js + React Query, Pulumi and GitHub Actions. Every file is commented for study.

## Start here

| If you want to… | Read |
|---|---|
| See the big picture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/diagrams/](docs/diagrams/README.md) (9 detailed draw.io diagrams with step-by-step walkthroughs) |
| Know which AWS service does what, and where | [SERVICE-MAP.md](SERVICE-MAP.md) |
| Study a concept (and break it on purpose) | [docs/CONCEPT-MAP.md](docs/CONCEPT-MAP.md), [docs/LEARNING-PATH.md](docs/LEARNING-PATH.md) |
| Understand why it is built this way | [docs/adr/](docs/adr/README.md) |
| Deploy it | [docs/CICD-SETUP.md](docs/CICD-SETUP.md) |
| Operate it | [docs/RUNBOOK.md](docs/RUNBOOK.md), [docs/COSTS.md](docs/COSTS.md), [docs/SECURITY.md](docs/SECURITY.md) |
| Deep dives | [EVENT-DRIVEN](docs/EVENT-DRIVEN.md) · [SEARCH](docs/SEARCH.md) · [CACHING](docs/CACHING.md) · [CODE-REVIEW](docs/CODE-REVIEW.md) |
| Build status, decisions, deviations from the spec | [PROGRESS.md](PROGRESS.md), [BUILD-SPEC.md](BUILD-SPEC.md) |

## Local development

Needs Node 24, pnpm 10.33.2 (`corepack enable`) and, for the first two modes, Docker. Run `pnpm install` once.
There are three ways to run TicketLite on your laptop:

| Mode | Start | Needs | What it is |
|---|---|---|---|
| **Mock** | `pnpm dev:mock` → http://localhost:4173 | Nothing (no AWS, no Docker) | The static site built with `NEXT_PUBLIC_MOCK=1`: MSW answers every REST, GraphQL and WebSocket call inside the browser, using the same handlers as the tests. Log in as `test@ticketlite.dev` / `Tickets2026x` (an admin). No hot reload: re-run after a change. |
| **Offline** | `pnpm dev` → web http://localhost:3001, API http://localhost:3000 (docs at `/api/docs`) | Docker | Real API and web dev servers (hot reload) on local stand-ins: DynamoDB Local (tables + sample events created on every start), Redis and OpenSearch containers. Nothing touches AWS. |
| **Connected** | `pnpm dev:env` once (and after each deploy), then `pnpm dev` | Docker, the deployed `dev` stack, `AWS_PROFILE=ticketlite` credentials | The same local API and web, but talking to the deployed AWS resources: real DynamoDB tables, Cognito, Step Functions, S3, EventBridge and AppSync. |

**`pnpm dev`** starts the containers, seeds DynamoDB Local (offline mode only), then runs the API and the web app side by
side; Ctrl+C stops both. It is in connected mode when `api/.env.local` exists. Delete that file to go back offline.
If port 6379 is taken: `REDIS_PORT=6380 pnpm dev`.

**`pnpm dev:env`** reads the stack outputs (`pulumi stack output --json` in `infra/`) and writes `api/.env.local`
and `web/.env.local`: table names, Cognito IDs, the state machine ARN, bucket names, the event bus, the AppSync URL
and its public API key, and the API URL. It never writes secrets: only an allow-list of outputs is written, and secret
outputs are refused. Secret values (payment key, Upstash URL) are read from Secrets Manager at runtime. Both files are
git-ignored. If the stack has not been deployed yet, the script says so and writes nothing.

### What works where

| Feature | Mock | Offline | Connected |
|---|---|---|---|
| Browse events, city filter, pagination, event detail (ETag) | ✅ (fake data) | ✅ | ✅ |
| Search | ✅ (fake) | ✅ DynamoDB fallback; full OpenSearch with `OPENSEARCH_ENDPOINT=http://localhost:9200` after `pnpm tsx scripts/index-local-search.ts` | ✅ fallback, or OpenSearch with `enableSearch` |
| Cache + rate limit (Redis) | — | ✅ with `CACHE_ENABLED=true REDIS_URL=redis://localhost:6379` | ✅ local Redis the same way |
| Sign up, login, refresh, logout, `/api/me`, PKCE demo | ✅ (fake) | ❌ needs Cognito | ✅ |
| Session demo (`/api/demo/session/*`) | — | ❌ login needs Cognito | ✅ |
| Booking (idempotency + Step Functions saga) and booking status | ✅ (fake saga) | ❌ needs Step Functions + Cognito | ✅ (real saga, real emails) |
| Admin create/edit (optimistic locking) | ✅ (fake) | ❌ admin needs Cognito | ✅ (your user in the `admin` group) |
| Poster upload | — | ❌ needs S3 | ✅ |
| Live seat counts, organizer names (AppSync) | ✅ (fake WebSocket) | ❌ | ✅ |
| Confirmation email, admin notifications | — | ❌ | ✅ |
| SQL reports | ✅ (fake) | ❌ | ✅ only with `enableSql` |

Connected mode uses your own AWS identity (`AWS_PROFILE=ticketlite`), not the Lambda roles, so permission problems
can differ from the cloud; the deployed app at the CloudFront URL is the final check.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm check:concepts   # types, lint, every CONCEPT tag documented
pnpm test            # unit + component tests (Vitest, React Testing Library, MSW, aws-sdk-client-mock)
pnpm test:coverage   # the same with coverage reports
pnpm e2e             # Playwright journeys + axe accessibility checks
pnpm build           # Lambda bundles, AppSync resolvers, static web export
cd infra && AWS_PROFILE=ticketlite pulumi preview    # the ONLY Pulumi command allowed locally
```

## How deploys work

Only GitHub Actions deploys. Pull requests run `ci.yml` (checks, E2E, and a read-only `pulumi preview` posted as a
comment). Merging to `main` runs `deploy.yml`: `pulumi up`, upload the site to S3, invalidate CloudFront, then Playwright
smoke tests against the live URL. `destroy.yml` tears everything down (type `destroy`). No AWS keys are stored
anywhere: GitHub OIDC → short-lived role credentials. Paid services sit behind flags that default to off.

## Repository map

| Folder | What lives there |
|---|---|
| `packages/shared` | Zod schemas + TypeScript types shared by api, functions and web |
| `packages/sql` | Optional SQL reporting: Drizzle schema, migrations, report queries |
| `api/` | Fastify REST API, one Lambda ("Lambdalith") |
| `functions/` | Small single-job Lambdas (saga steps, workers, indexers) |
| `graphql/` | AppSync schema + JS resolvers |
| `web/` | Next.js frontend (static export) |
| `e2e/` | Playwright tests (mock mode) and post-deploy smoke tests |
| `infra/` | Pulumi program, one file per service area |
| `bootstrap/` | One-time Pulumi stack: GitHub OIDC + CI roles |
| `scripts/` | Seed data, local tables, local search backfill |
| `docs/` | Architecture (+ draw.io diagrams in `docs/diagrams/`), concept map, ADRs, runbook, security, costs |
| `notes/` | Personal study notes |
