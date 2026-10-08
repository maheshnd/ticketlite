# Service map

Every AWS service TicketLite uses → where it is defined (Pulumi) → which app code uses it → why → the flag that
turns it on (if any). Updated in every milestone that adds or changes a service.

| AWS service | Pulumi file | App files | Why we use it | Flag |
|---|---|---|---|---|
| **CloudFront** | `infra/cdn.ts`, `infra/cdn-rewrite.js` | `.github/workflows/deploy.yml` (invalidation) | The single public entry point: serves the static web app from S3 and forwards `/api/*` to API Gateway, so web and API share one origin (first-party cookies, no CORS). Adds security headers (HSTS, CSP, …) and caches at the edge. A CloudFront Function maps `/event` → `event.html`. | — |
| **S3** | `infra/storage.ts`, `infra/cdn.ts` (bucket policies) | `deploy.yml` (upload) | `web` bucket holds the Next.js static export; `posters` bucket holds event posters. Both private, readable only by CloudFront via Origin Access Control. | — |
| **Lambda** | `infra/lambdas.ts`, `infra/node-function.ts` | `api/src/lambda.ts`, `api/build.mjs` | Runs the Fastify API without servers: pay per request, $0 when idle, scales automatically. nodejs24.x on arm64 (cheaper Graviton). Published versions + a `live` alias give a rollback/canary target. | `enableProvisionedConcurrency`, `reservedConcurrency` |
| **API Gateway (HTTP API)** | `infra/http-api.ts` (API, stage), `infra/http-routes.ts` (routes, integration, JWT authorizer) | `api/src/routes/*` | The HTTPS front door of the api Lambda. Explicit public routes and JWT-protected routes (a Cognito JWT authorizer rejects bad tokens before Lambda runs), throttling at 20 req/s (burst 40), JSON access logs. Cheaper and simpler than a REST API. | — |
| **DynamoDB** | `infra/dynamodb.ts` | `api/src/repositories/*`, `api/src/lib/dynamodb.ts`, `scripts/seed.ts` | The database: Events (GSIs `byCity`, `byStatus`, stream), Bookings (GSIs `byUser`, `byEvent`, stream), IdempotencyKeys (TTL), Sessions (TTL, session demo), Organizers. On-demand billing ($0 idle), encrypted at rest with an AWS-owned key. | — |
| **Cognito** | `infra/cognito.ts` | `api/src/lib/cognito.ts`, `api/src/lib/jwt.ts`, `api/src/lib/cognito-oauth.ts`, `api/src/routes/auth.ts`, `oauth.ts` | The user directory: email sign-up + verification, password policy and hashing, the `admin` group, tokens (15-min access, 7-day refresh, revocable), and the managed login domain for the authorization code + PKCE demo. Essentials tier: free up to 10,000 MAU. | — |
| **CloudWatch Logs** | `infra/node-function.ts`, `infra/http-api.ts` | `api/src/app.ts` (JSON logs) | Lambda logs and API Gateway access logs, in log groups we create with 7-day retention so logs don't pile up forever. | — |
| **X-Ray** | `infra/node-function.ts` (`tracingConfig: Active`), `infra/iam.ts` | — | Traces every Lambda invocation (and, later, its AWS SDK calls) so slow or failing steps are visible. HTTP APIs themselves don't support X-Ray. | — |
| **IAM (roles and policies)** | `infra/iam.ts`, `bootstrap/roles.ts` | — | Least-privilege identities. Each Lambda gets its own role (logs + X-Ray + only what it uses). CI roles: preview is read-only for PRs, deploy is admin and main-branch only. | — |
| **IAM OIDC identity provider** | `bootstrap/oidc.ts` | — | Lets GitHub Actions prove who it is with a short-lived signed token. No long-lived AWS access keys are stored in GitHub. | — |
| **STS** (no resources) | — | `.github/workflows/*.yml` (via `aws-actions/configure-aws-credentials`) | `AssumeRoleWithWebIdentity` swaps the GitHub OIDC token for temporary AWS keys (1 hour). | — |

Not AWS, but part of the picture:
- **Pulumi Cloud** stores the state of both stacks (`ticketlite-infra/dev`, `ticketlite-bootstrap/dev`). CI logs in with the `PULUMI_ACCESS_TOKEN` secret.
- **GitHub Actions** is the only thing that deploys (`.github/workflows/deploy.yml`, `destroy.yml`); `ci.yml` checks pull requests.
