// Pipeline function 1: role check. Cognito puts the user's groups in the token; AppSync exposes them as
// ctx.identity.groups. (A schema directive @aws_cognito_user_pools(cognito_groups: ["admin"]) would do the
// same; a pipeline step shows how custom checks are composed.) CONCEPT: rbac
import { type Context, util } from "@aws-appsync/utils";

export function request(ctx: Context) {
  const identity = ctx.identity as { groups?: string[] | null } | null;
  const groups = identity?.groups ?? [];
  if (!groups.includes("admin")) util.unauthorized(); // ends the whole request with "Unauthorized"
  return { payload: null }; // NONE data source: nothing to send anywhere
}

export function response() {
  return null;
}
