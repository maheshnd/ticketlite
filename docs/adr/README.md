# Architecture decision records

Short records of the decisions that shaped TicketLite: context, decision, alternatives, consequences.

| # | Decision |
|---|---|
| [0001](0001-lambdalith-plus-functions.md) | One Fastify Lambda for REST, small Lambdas for async work |
| [0002](0002-separate-dynamodb-tables.md) | Separate DynamoDB tables (vs single-table design) |
| [0003](0003-bff-token-storage.md) | BFF auth: access token in memory, refresh token in an HttpOnly cookie |
| [0004](0004-saga-orchestration.md) | Booking saga orchestrated by Step Functions (vs choreography) |
| [0005](0005-standard-workflow.md) | Step Functions Standard (vs Express) |
| [0006](0006-graphql-client.md) | Typed fetch + hand-written AppSync WebSocket client (vs Amplify/Apollo) |
| [0007](0007-encryption-keys.md) | AWS-owned/managed encryption keys (vs customer-managed KMS) |
| [0008](0008-sql-reporting.md) | Optional SQL reporting: Aurora Serverless v2 + Data API + Drizzle |
| [0009](0009-static-export.md) | Next.js static export on S3 + CloudFront (vs SSR/ISR) |
| [0010](0010-pulumi-and-github-oidc.md) | Pulumi + GitHub Actions with OIDC as the only deployer |
