# functions

Small single-job Lambdas, one folder each (`<name>/handler.ts` + `README.md`). `pnpm --filter @ticketlite/functions build`
bundles every folder with a `handler.ts` into `<name>/dist/index.js`; Pulumi zips each `dist/` into its own Lambda.

| Folder | Trigger | Job |
|---|---|---|
| `booking-reserve-seat` | Step Functions (sync) | Saga step 1: take seats + mark booking, one transaction |
| `booking-process-payment` | Step Functions (sync) | Saga step 2: fake payment (`.13` declines), circuit breaker |
| `booking-confirm` | Step Functions (sync) | Saga step 3: booking → CONFIRMED |
| `booking-release-seat` | Step Functions (sync) | Saga compensation: give seats back, booking → FAILED |
| `poster-processor` | S3 ObjectCreated (async) | Validate a poster by its bytes, attach it to the event |
| `appsync-organizer-batch` | AppSync (sync, BatchInvoke) | `Event.organizer` for many events in one call (N+1 fix) |
| `email-worker` | SQS (poll) ← EventBridge `BookingConfirmed` | Confirmation email via SES, idempotent, partial batch response |
| `search-indexer` | DynamoDB Stream (poll) | Events table → OpenSearch index (flag `enableSearch`) |
| `shared/` | — | Powertools Logger/Tracer, DynamoDB/EventBridge/OpenSearch clients, AppSync publisher, saga types |

Every function: Node 24 on arm64, its own IAM role, 7-day log group, X-Ray tracing, Powertools JSON logs.
Tests: `pnpm --filter @ticketlite/functions test` (AWS calls mocked with `aws-sdk-client-mock`).
