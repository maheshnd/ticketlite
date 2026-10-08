# appsync-organizer-batch

Resolves `Event.organizer` for AppSync, many events at once (the N+1 fix).

- **Trigger / invocation:** AppSync Lambda data source, synchronous, `BatchInvoke` with `maxBatchSize: 20`
  (`infra/appsync.ts`, `graphql/resolvers/field-event-organizer.ts`).
- **Does:** receives a list of `{ organizerId }`, does ONE `BatchGetItem` for the unique ids, returns one organizer
  (or null) per input, in order.
- **See the N+1 problem:** query `events { items { name organizer { name } } }`. With BatchInvoke the logs show one
  invocation with `batchSize: N`. Set `maxBatchSize: 0` in `infra/appsync.ts` and AppSync invokes it N times.
- **Retries:** none (AppSync returns the error for that field; the rest of the query still succeeds).
- **IAM:** `dynamodb:BatchGetItem` on the Organizers table.
