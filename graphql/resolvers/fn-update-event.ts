// Pipeline function 2 for updateEvent: UpdateItem that only succeeds if `version` is still the one the
// admin loaded (optimistic locking, the same rule as the REST API). CONCEPT: optimistic-locking
import { type Context, util } from "@aws-appsync/utils";

type Args = { id: string; input: { version: number } & Record<string, unknown> };

export function request(ctx: Context<Args>) {
  const { version, ...changes } = ctx.args.input;
  const names: Record<string, string> = { "#version": "version" };
  const values: Record<string, unknown> = { ":expected": version, ":one": 1, ":now": util.time.nowISO8601() };
  const sets = ["#version = #version + :one", "updatedAt = :now"];

  // One "SET #field = :field" per field the admin actually sent.
  for (const field of Object.keys(changes)) {
    if (changes[field] !== null && changes[field] !== undefined) {
      names[`#${field}`] = field;
      values[`:${field}`] = changes[field];
      sets.push(`#${field} = :${field}`);
    }
  }

  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({ eventId: ctx.args.id }),
    update: {
      expression: `SET ${sets.join(", ")}`,
      expressionNames: names,
      expressionValues: util.dynamodb.toMapValues(values),
    },
    condition: { expression: "#version = :expected" },
  };
}

export function response(ctx: Context) {
  if (ctx.error) {
    if (ctx.error.type === "DynamoDB:ConditionalCheckFailedException") {
      util.error(
        "Someone else changed this event after you opened it. Reload to see their changes.",
        "ConflictError",
      );
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
