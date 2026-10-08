# Runbook

Operations for the `dev` stack. Completed in M6/M7 (logs, traces, rollback, cost checks).

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
