# poster-processor

Attaches an uploaded poster to its event.

- **Trigger / invocation:** S3 `ObjectCreated` on the posters bucket, prefix `posters/`. **Asynchronous**: S3 hands
  the event to Lambda's internal queue and doesn't wait.
- **Does:** reads the first 12 bytes (`Range` GET) to check the real file type (JPEG/PNG/WebP), checks the size,
  then sets the event's `posterKey`. Invalid files are deleted.
- **Retries:** Lambda retries a failed async invocation 2 times (max event age 1 hour).
- **Failure destination:** after the retries, the event goes to the SQS queue `poster-failures` (14-day retention)
  for inspection and redrive (see docs/RUNBOOK.md).
- **IAM:** `s3:GetObject` + `s3:DeleteObject` on `posters/*`, `dynamodb:UpdateItem` on Events,
  `sqs:SendMessage` on the failure queue (destinations use the function's own role).
