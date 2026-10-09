# email-worker

Sends the booking confirmation email.

- **Trigger / invocation:** EventBridge rule `BookingConfirmed` → SQS `email-queue` → this Lambda. **Poll-based**:
  the Lambda service polls the queue; batch size 5, at most 2 concurrent copies (gentle on SES).
- **Does:** checks the booking's `emailSentAt` marker, sends via SES, sets the marker. Duplicates (SQS is
  at-least-once) are skipped.
- **Partial batch response:** returns the ids of the messages that failed; only those return to the queue.
- **Retries / DLQ:** a message is retried after the visibility timeout (60 s, 6× the function timeout so a slow run
  never lets a second copy pick up the same message). After 3 receives it moves to `email-dlq`.
  Redrive: docs/RUNBOOK.md.
- **SES sandbox:** emails go to the verified address in `sesEmail` (Pulumi config) only.
- **IAM** (`infra/events.ts`): `sqs:ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` on `email-queue` (the
  event source mapping polls as this role); `ses:SendEmail` on the verified identity; `dynamodb:GetItem` +
  `UpdateItem` on Bookings (the `emailSentAt` marker). Plus logs + X-Ray.
