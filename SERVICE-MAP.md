# Service map

Every AWS service TicketLite uses, where it is defined, and why. Update this in every task.

| AWS service | Files | Why we use it |
|---|---|---|
| **Lambda** | `infra/lambda.ts`, `api/src/lambda.ts`, `api/build.mjs` | Runs the Fastify API without servers. We pay per request, it costs $0 when idle, and it scales automatically. nodejs24.x on arm64 (cheaper Graviton). |
| **API Gateway (HTTP API)** | `infra/api.ts` | The public HTTPS URL in front of the Lambda. An HTTP API is cheaper and simpler than a REST API. The `$default` stage throttles at 20 req/s (burst 40) to cap cost. |
| **CloudWatch Logs** | `infra/lambda.ts` | Stores the Lambda's JSON logs from Fastify. We create the log group ourselves with 7-day retention, so logs don't pile up forever. |
| **IAM (roles and policies)** | `infra/iam.ts`, `bootstrap/roles.ts` | Least-privilege identities. The Lambda role can only write logs. The CI roles: preview is read-only for PRs, deploy is admin and main branch only. |
| **IAM OIDC identity provider** | `bootstrap/oidc.ts` | Lets GitHub Actions prove who it is with a short-lived signed token. No long-lived AWS access keys are stored in GitHub. |
| **STS** (no resources) | `.github/workflows/*.yml` (via `aws-actions/configure-aws-credentials`) | `AssumeRoleWithWebIdentity` swaps the GitHub OIDC token for temporary AWS keys (1 hour). |

Not AWS, but part of the picture:
- **Pulumi Cloud** stores the state of both stacks (`ticketlite-infra/dev`, `ticketlite-bootstrap/dev`). CI logs in with the `PULUMI_ACCESS_TOKEN` secret.
- **GitHub Actions** is the only thing that deploys (`.github/workflows/deploy.yml`, `destroy.yml`).
