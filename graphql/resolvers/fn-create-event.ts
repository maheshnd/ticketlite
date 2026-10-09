// Pipeline function 2 for createEvent: PutItem with a generated id, version 1, all seats available.
// CONCEPT: appsync-resolvers
import { type Context, util } from "@aws-appsync/utils";

type Input = { totalSeats: number } & Record<string, unknown>;

export function request(ctx: Context<{ input: Input }>) {
  const now = util.time.nowISO8601();
  const input = ctx.args.input;
  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ eventId: `evt-${util.autoId()}` }),
    attributeValues: util.dynamodb.toMapValues({
      ...input,
      availableSeats: input.totalSeats,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }),
    condition: { expression: "attribute_not_exists(eventId)" },
  };
}

export function response(ctx: Context) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}
