// Query.events(city, limit, nextToken): a JS resolver that talks to DynamoDB DIRECTLY (no Lambda: faster,
// cheaper, nothing to cold-start). Same access patterns as the REST API: byCity or byStatus. CONCEPT: appsync-resolvers
//
// APPSYNC_JS is a restricted JavaScript runtime: no try/catch or throw (use util.error), no classes,
// no `++`. Keep resolvers small and declarative.
import { type Context, util } from "@aws-appsync/utils";

type Args = { city?: string; limit?: number; nextToken?: string };

export function request(ctx: Context<Args>) {
  const limit = Math.min(ctx.args.limit ?? 20, 50);
  const published = util.dynamodb.toMapValues({ ":published": "PUBLISHED" });

  // With a city: the byCity index, drafts filtered out (filters run AFTER the read, like in the REST API).
  if (ctx.args.city) {
    return {
      operation: "Query",
      index: "byCity",
      query: {
        expression: "city = :city",
        expressionValues: util.dynamodb.toMapValues({ ":city": ctx.args.city }),
      },
      filter: {
        expression: "#status = :published",
        expressionNames: { "#status": "status" },
        expressionValues: published,
      },
      limit,
      nextToken: ctx.args.nextToken,
    };
  }
  // Without: every published event, soonest first.
  return {
    operation: "Query",
    index: "byStatus",
    query: {
      expression: "#status = :published",
      expressionNames: { "#status": "status" },
      expressionValues: published,
    },
    limit,
    nextToken: ctx.args.nextToken,
  };
}

export function response(ctx: Context) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return { items: ctx.result.items, nextToken: ctx.result.nextToken };
}
