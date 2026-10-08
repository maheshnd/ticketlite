# Runbook

Operations for the `dev` stack. Run commands from `infra/` with AWS credentials (`AWS_PROFILE=ticketlite`).

## Alarms

Every alarm emails the `alarms` SNS topic (confirm the subscription once). Dashboard: CloudWatch → Dashboards →
`ticketlite-dev`.

| Alarm | Likely cause | First look |
|---|---|---|
| `api-5xx` | A bug or a dependency down | Logs Insights query below, filter `res.statusCode >= 500` |
| `lambda-errors` / `lambda-throttles` | Any function failing / concurrency exhausted | Lambda console → Monitor; throttles: check `reservedConcurrency` and account limits |
| `booking-saga-failed` | ConfirmFailed or CompensationFailed: money or seats stuck | Step Functions console → failed execution → the failing state's input/error |
| `email-dlq`, `poster-failures`, `search-indexer-failures` | Messages that gave up | [Dead-letter queues](#dead-letter-queues) |

## Find a request by correlation ID

Every API response has `x-correlation-id`; the same value is in every API log line, in the saga input and in the
saga Lambdas' logs (`correlationId`). CloudWatch → Logs Insights, select `/aws/lambda/ticketlite-*-dev`:

```
fields @timestamp, @log, level, msg, correlationId, res.statusCode
| filter correlationId = "<id>"
| sort @timestamp asc
```

Errors in the last hour: `filter level = 50 or level = "ERROR" | stats count() by @log`.

## Read traces

X-Ray (CloudWatch → X-Ray traces → Trace map): every Lambda, its AWS SDK calls, the state machine and AppSync. Open
a slow trace to see which segment took the time. (The HTTP API itself is not traced; X-Ray starts at the Lambda.)

## Roll back a deploy

1. **Code (fastest):** point the api alias back at the previous version (no rebuild):
   `aws lambda update-alias --function-name ticketlite-api-dev --name live --function-version <previous number>`
   (`aws lambda list-versions-by-function --function-name ticketlite-api-dev` lists them). The next deploy moves it forward again.
2. **Everything:** `git revert` the bad commit on a branch, open a PR, merge: CI redeploys the previous state.
3. **Web only:** re-run the deploy workflow of the last good commit (Actions → deploy → that run → Re-run).

Canary option: give the alias two versions with weights (`routingConfig: { additionalVersionWeights: { "<new>": 0.1 } }`)
or use CodeDeploy's `Canary10Percent5Minutes` with alarms as automatic rollback triggers.

## Cost checks

- Billing → Cost Explorer, filter by tag `project = ticketlite` (every resource is tagged by Pulumi).
- Flags that cost money while idle: `enableSearch`, `enableWaf`, `enableProvisionedConcurrency`, `enableSql` (storage).
- Done for a while? Actions → **destroy** (type `destroy`). See docs/COSTS.md.

## Dead-letter queues

| Queue | Fed by | Holds |
|---|---|---|
| `email-dlq` | `email-queue` after 3 failed receives | The full EventBridge event (BookingConfirmed) |
| `poster-failures` | poster-processor async destination | The S3 event + error (`requestContext`, `responsePayload`) |
| `search-indexer-failures` | search-indexer on-failure destination | Metadata of the failed stream batch (shard, sequence numbers), not the records |

Inspect (read without deleting; messages become visible again after the visibility timeout):

```bash
cd infra
aws sqs get-queue-attributes --queue-url "$(pulumi stack output emailDlqUrl)" --attribute-names ApproximateNumberOfMessages
aws sqs receive-message --queue-url "$(pulumi stack output emailDlqUrl)" --max-number-of-messages 5 --visibility-timeout 30
```

Redrive the email DLQ back to its source queue (after fixing the cause):

```bash
aws sqs start-message-move-task --source-arn <email-dlq ARN>      # destination defaults to the original source queue
aws sqs list-message-move-tasks --source-arn <email-dlq ARN>      # progress
```

`poster-failures` and `search-indexer-failures` are destinations, not DLQs of a source queue: re-run by hand
(re-upload the poster; for the index, touch the affected events or run a backfill like
`scripts/index-local-search.ts` against the domain).
