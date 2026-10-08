// Minimal AppSync GraphQL client: queries over fetch, typed by GraphQL Code Generator. See
// docs/adr/0006-graphql-client.md for why there is no Amplify/Apollo here. CONCEPT: graphql-client
//
// Auth: a logged-in user sends their Cognito access token (the API's default mode); a visitor sends the
// public API key. AppSync picks the mode from the header.
import type { TypedDocumentString } from "../gql/graphql";
import { getAccessToken } from "./token-store";

// Baked in at build time (deploy.yml). Unset locally and in tests: GraphQL features then stay quiet.
export const APPSYNC_URL = process.env.NEXT_PUBLIC_APPSYNC_URL ?? "";
const APPSYNC_API_KEY = process.env.NEXT_PUBLIC_APPSYNC_API_KEY ?? "";
export const appsyncEnabled = APPSYNC_URL !== "";

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: token } : { "x-api-key": APPSYNC_API_KEY };
}

export async function appsyncQuery<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
): Promise<TResult> {
  const response = await fetch(APPSYNC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query: document.toString(), variables }),
  });
  // GraphQL reports errors in the body (often with HTTP 200), next to any partial data.
  const result = (await response.json()) as { data?: TResult; errors?: Array<{ message: string }> };
  if (result.errors?.length) throw new Error(result.errors.map((e) => e.message).join("; "));
  return result.data as TResult;
}
