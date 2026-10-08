# infra

The Pulumi program for TicketLite (stack `dev`, region `us-east-1`).

- **Deploys:** only through GitHub Actions (`.github/workflows/deploy.yml`) on merge to `main`.
- **Locally:** you may only preview: `AWS_PROFILE=ticketlite pulumi preview`. Run `pnpm build` at the repo root
  first: Pulumi reads `../api/dist`, `../functions/*/dist` and `../graphql/dist`.
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
| `appsync.ts` | GraphQL API (3 auth modes), API key, data sources, JS + pipeline resolvers, organizer batch Lambda |
| `events.ts` | EventBridge bus + rules, SQS email queue + DLQ, email-worker, SES identity, SNS admin topic |
| `search.ts` | (flag `enableSearch`) OpenSearch domain, search-indexer + stream mapping + failure queue |
| `secrets.ts` | Secrets Manager containers (payment key; Upstash URL with `enableCache`) |
| `partner-api.ts` | REST API for partners: API key, usage plan (rate + daily quota), X-Ray |
| `observability.ts` | `alarms` SNS topic, 7 alarms, CloudWatch dashboard |
| `waf.ts` | (flag `enableWaf`) WAF web ACL for CloudFront |
| `sql.ts` | (flag `enableSql`) Aurora Serverless v2 PostgreSQL (scale to zero, Data API), sql-reporter |
| `uploads.ts` | Posters bucket CORS, poster-processor (async S3 trigger), `poster-failures` queue |
| `storage.ts` | `web` and `posters` S3 buckets (private) |
| `cdn.ts` | CloudFront: OAC, S3 + API origins, security headers, bucket policies |
| `cdn-rewrite.js` | CloudFront Function: `/event` → `/event.html` |

## Outputs

`cloudFrontUrl`, `distributionId`, `apiUrl`, `webBucketName`, `postersBucketName`, `userPoolId`,
`userPoolClientId`, `cognitoDomain`, `eventsTableName`, `organizersTableName`, `appsyncUrl`, `appsyncApiKey`,
`eventBusName`, `emailDlqUrl`, `paymentSecretArn`, `redisSecretArn`, `partnerApiUrl`, `partnerApiKey` (secret).

Why `http-api.ts` and `http-routes.ts` are two files: CloudFront needs the API's URL, Cognito needs
CloudFront's URL (OAuth callback), and the routes need Cognito (authorizer). One file would be an import cycle.
