# sql-reporter

Copies bookings into Aurora PostgreSQL for SQL reports. Only exists with `enableSql`.

- **Trigger / invocation:** DynamoDB Stream on Bookings (`NEW_IMAGE`), poll-based, batch size 10, in order per booking.
- **Does:** on cold start applies pending Drizzle migrations (`packages/sql/migrations`, copied to `dist/migrations`),
  then UPSERTs an `events` row and a `bookings` row per change (idempotent).
- **Scale to zero:** when the cluster is paused the first call fails while it resumes (~15 s); the batch is retried.
- **Retries / failures:** like search-indexer: bisect on error, 5 attempts, records older than 1 hour dropped,
  on-failure destination `sql-reporter-failures`.
- **IAM:** read the Bookings stream; `rds-data:ExecuteStatement`, `BatchExecuteStatement`, `BeginTransaction`,
  `CommitTransaction`, `RollbackTransaction` on the cluster; `secretsmanager:GetSecretValue` on the cluster's
  managed master secret; `sqs:SendMessage` on the failure queue.
