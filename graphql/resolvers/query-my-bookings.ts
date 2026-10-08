// Query.myBookings: the caller's bookings, newest first. The user id comes from the verified token
// (ctx.identity.sub), never from an argument, so nobody can ask for someone else's bookings.
// CONCEPT: authentication-vs-authorization
import { type Context, util } from "@aws-appsync/utils";

type Args = { limit?: number; nextToken?: string };

export function request(ctx: Context<Args>) {
  const identity = ctx.identity as { sub: string };
  return {
    operation: "Query",
    index: "byUser",
    query: {
      expression: "userId = :userId",
      expressionValues: util.dynamodb.toMapValues({ ":userId": identity.sub }),
    },
    scanIndexForward: false,
    limit: Math.min(ctx.args.limit ?? 10, 50),
    nextToken: ctx.args.nextToken,
  };
}

export function response(ctx: Context) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return { items: ctx.result.items, nextToken: ctx.result.nextToken };
}
