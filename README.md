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
| See the big picture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Know which AWS service does what, and where | [SERVICE-MAP.md](SERVICE-MAP.md) |
| Study a concept (and break it on purpose) | [docs/CONCEPT-MAP.md](docs/CONCEPT-MAP.md), [docs/LEARNING-PATH.md](docs/LEARNING-PATH.md) |
| Understand why it is built this way | [docs/adr/](docs/adr/README.md) |
| Deploy it | [docs/CICD-SETUP.md](docs/CICD-SETUP.md) |
| Operate it | [docs/RUNBOOK.md](docs/RUNBOOK.md), [docs/COSTS.md](docs/COSTS.md), [docs/SECURITY.md](docs/SECURITY.md) |
| Deep dives | [EVENT-DRIVEN](docs/EVENT-DRIVEN.md) · [SEARCH](docs/SEARCH.md) · [CACHING](docs/CACHING.md) · [CODE-REVIEW](docs/CODE-REVIEW.md) |
| Build status, decisions, deviations from the spec | [PROGRESS.md](PROGRESS.md), [BUILD-SPEC.md](BUILD-SPEC.md) |

## Quick start (local)

Needs Node 24, pnpm 10.33.2 (`corepack enable`) and Docker.

```bash
pnpm install                       # one install for the whole workspace
docker compose up -d               # Redis, OpenSearch, DynamoDB Local (REDIS_PORT=6380 if 6379 is taken)
pnpm db:local                      # create the tables in DynamoDB Local and add sample events
cp api/.env.example api/.env       # local settings (add Cognito IDs from `pulumi stack output` for login)
pnpm --filter @ticketlite/api dev  # API on http://localhost:3000 (docs at /api/docs)
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @ticketlite/web dev   # web on http://localhost:3001
```

Everything without AWS or Docker, in the browser with mocked APIs: `pnpm e2e` (builds the mock-mode site and runs
Playwright), or `pnpm --filter @ticketlite/e2e build:mock && node e2e/serve.mjs` and open http://localhost:4173.

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
| `docs/` | Architecture, concept map, ADRs, runbook, security, costs |
| `notes/` | Personal study notes |
