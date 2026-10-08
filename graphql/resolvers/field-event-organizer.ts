// Event.organizer: resolved by a Lambda with BatchInvoke. CONCEPT: n-plus-one
//
// The N+1 problem: a query for 20 events with their organizer would normally run 1 query for the events
// + 20 lookups (one per event). With "BatchInvoke" + maxBatchSize (infra/appsync.ts), AppSync collects the
// organizer lookups of many events and calls the Lambda ONCE with all of them; the Lambda answers with one
// DynamoDB BatchGetItem. See functions/appsync-organizer-batch.
import type { Context } from "@aws-appsync/utils";

export function request(ctx: Context) {
  const source = ctx.source as { organizerId: string };
  return { operation: "BatchInvoke", payload: { organizerId: source.organizerId } };
}

export function response(ctx: Context) {
  return ctx.result;
}
