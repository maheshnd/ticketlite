# TicketLite

A small ticket-booking app built to learn AWS serverless in depth: Lambda, API Gateway, DynamoDB, Cognito,
Step Functions, AppSync (GraphQL), EventBridge/SQS/SNS, OpenSearch, CloudFront, Pulumi and GitHub Actions.

Users browse and search events, book seats and get a confirmation email. Admins create events and upload posters.
Partners read events through a keyed API. The full specification is in [BUILD-SPEC.md](BUILD-SPEC.md), and build
progress is in [PROGRESS.md](PROGRESS.md).

## Quick start (local)

Needs Node 24, pnpm 10.33.2 (`corepack enable`) and Docker.

```bash
pnpm install                       # one install for the whole workspace
docker compose up -d               # Redis, OpenSearch, DynamoDB Local
pnpm db:local                      # create the tables in DynamoDB Local and add sample events
cp api/.env.example api/.env       # local settings (add Cognito IDs from `pulumi stack output` for login)
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @ticketlite/api dev  # API on http://localhost:3000 (docs at /api/docs)
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @ticketlite/web dev   # web on http://localhost:3001
```

## How deploys work

Only GitHub Actions deploys. Merging to `main` runs `pulumi up`; pull requests get a `pulumi preview` comment.
One-time setup: [docs/CICD-SETUP.md](docs/CICD-SETUP.md).

## Repository map

| Folder | What lives there |
|---|---|
| `packages/shared` | Zod schemas + TypeScript types shared by api, functions and web |
| `api/` | Fastify REST API, one Lambda ("Lambdalith") |
| `functions/` | Small single-job Lambdas |
| `web/` | Next.js frontend (static export) |
| `graphql/` | AppSync schema + JS resolvers |
| `infra/` | Pulumi program, one file per service area |
| `bootstrap/` | One-time Pulumi stack: GitHub OIDC + CI roles |
| `e2e/` | Playwright tests |
| `docs/` | Architecture, concept map, ADRs, runbook |

More docs: [SERVICE-MAP.md](SERVICE-MAP.md) · [docs/CONCEPT-MAP.md](docs/CONCEPT-MAP.md)
