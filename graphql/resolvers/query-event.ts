// Query.event(id): GetItem straight from DynamoDB. Drafts are invisible here, like in the REST API.
import { type Context, util } from "@aws-appsync/utils";

export function request(ctx: Context<{ id: string }>) {
  return { operation: "GetItem", key: util.dynamodb.toMapValues({ eventId: ctx.args.id }) };
}

export function response(ctx: Context) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  if (!ctx.result || ctx.result.status !== "PUBLISHED") return null;
  return ctx.result;
}
