// The outer code of a PIPELINE resolver (createEvent, updateEvent). A pipeline runs functions in order,
// each seeing the previous one's result in ctx.prev.result:
//   1. check-admin  (NONE data source): stop here unless the caller is in the "admin" group
//   2. create-event / update-event (DynamoDB data source): the write
// This outer code runs before the first and after the last function. CONCEPT: pipeline-resolvers
import type { Context } from "@aws-appsync/utils";

export function request() {
  return {};
}

export function response(ctx: Context) {
  return ctx.prev.result;
}
