# poster-processor

Attaches an uploaded poster to its event.

- **Trigger / invocation:** S3 `ObjectCreated` on the posters bucket, prefix `posters/`. **Asynchronous**: S3 hands
  the event to Lambda's internal queue and doesn't wait.
- **Does:** reads the first 12 bytes (`Range` GET) to check the real file type (JPEG/PNG/WebP), checks the size,
  then sets the event's `posterKey`. Invalid files are deleted.
- **Retries:** Lambda retries a failed async invocation 2 times (max event age 1 hour).
- **Failure destination:** after the retries, the event goes to the SQS queue `poster-failures` (14-day retention)
  for inspection and redrive (see docs/RUNBOOK.md).
- **IAM** (`infra/uploads.ts`): `s3:GetObject` (the Range read) + `s3:DeleteObject` (invalid files) on
  `posters/*` only, `dynamodb:UpdateItem` on Events (`posterKey`), `sqs:SendMessage` on `poster-failures`
  (destinations use the function's own role). Plus logs + X-Ray. The upload itself is authorized by the api
  role's `s3:PutObject` on `posters/*` (a presigned POST carries the signer's permissions).
