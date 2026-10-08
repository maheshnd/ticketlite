# infra

The Pulumi program for TicketLite (stack `dev`, region `us-east-1`).

- **Deploys:** only through GitHub Actions (`.github/workflows/deploy.yml`) on merge to `main`.
- **Locally:** you may only preview: `AWS_PROFILE=ticketlite pulumi preview`. Run `pnpm build` at the repo root
  first, because the Lambda code comes from `../api/dist` (and later `../functions/*/dist`).
- **Config:** `Pulumi.dev.yaml` holds the region, default tags, the cost-safety flags (all `false`) and emails.
  `config.ts` reads them once.
- **Tests:** `pnpm --filter @ticketlite/infra test` (the CloudFront rewrite function).
- **Validate the state machine** without deploying (read-only API): see `booking-state-machine.md`.

## Files (one per service area; `index.ts` only wires them and exports outputs)

| File | What it creates |
|---|---|
| `config.ts` | Typed stack config + flags |
| `iam.ts` | `createLambdaRole()`: one least-privilege role per function |
| `node-function.ts` | `createNodeFunction()`: log group + role + arm64 Node 24 Lambda with X-Ray |
| `lambdas.ts` | The api Lambda, its `live` alias, provisioned concurrency (flag) |
| `dynamodb.ts` | Events, Bookings, IdempotencyKeys, Sessions, Organizers tables (GSIs, streams, TTL) |
| `cognito.ts` | User pool, `admin` group, managed login domain, app client, branding |
| `http-api.ts` | HTTP API (local-only CORS) |
| `http-routes.ts` | Lambda integration, public routes, JWT authorizer + protected routes, stage (throttling, access logs) |
| `stepfunctions.ts` | Booking saga: 4 Lambdas + Standard state machine (`booking-state-machine.asl.json`, explained in `.md`) |
| `uploads.ts` | Posters bucket CORS, poster-processor (async S3 trigger), `poster-failures` queue |
| `storage.ts` | `web` and `posters` S3 buckets (private) |
| `cdn.ts` | CloudFront: OAC, S3 + API origins, security headers, bucket policies |
| `cdn-rewrite.js` | CloudFront Function: `/event` → `/event.html` |

## Outputs

`cloudFrontUrl`, `distributionId`, `apiUrl`, `webBucketName`, `postersBucketName`, `userPoolId`,
`userPoolClientId`, `cognitoDomain`, `eventsTableName`, `organizersTableName`.

Why `http-api.ts` and `http-routes.ts` are two files: CloudFront needs the API's URL, Cognito needs
CloudFront's URL (OAuth callback), and the routes need Cognito (authorizer). One file would be an import cycle.
