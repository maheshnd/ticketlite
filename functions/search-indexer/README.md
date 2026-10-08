# search-indexer

Keeps the OpenSearch `events` index in sync with the DynamoDB Events table (a CQRS read model).

- **Trigger / invocation:** DynamoDB Stream on Events (`NEW_AND_OLD_IMAGES`), **poll-based**: Lambda reads each
  shard in order, batch size 10. Only exists when `enableSearch` is true.
- **Does:** PUBLISHED → upsert the document; draft or deleted → delete it. Creates the index with its mapping
  (`packages/shared/src/search.ts`) on first use.
- **Retries:** up to 3 per batch, records older than 1 hour are dropped. `bisectBatchOnFunctionError` splits a
  failing batch in two to isolate a poison record. Partial batch response: the first failing record's sequence
  number is returned, and Lambda retries from it (stream order is kept).
- **Failure destination:** the SQS queue `search-indexer-failures` gets metadata about records that gave up.
  Re-index them by touching the events or by a backfill (see docs/RUNBOOK.md).
- **Eventual consistency:** search results lag DynamoDB by about a second.
- **IAM:** read the Events stream (`dynamodb:GetRecords`, `GetShardIterator`, `DescribeStream`, `ListStreams`),
  `es:ESHttpGet/Put/Post/Delete/Head` on the domain, `sqs:SendMessage` on the failure queue.
