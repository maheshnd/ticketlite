// Turns DynamoDB's LastEvaluatedKey into an opaque cursor string, and back.
// Clients pass the cursor back unchanged to get the next page; they never build one. CONCEPT: pagination
import { badRequest } from "../errors";

type Key = Record<string, string | number>;

// Step 1: key -> base64url(JSON). URL-safe, so it can go in a query string as-is.
export function encodeCursor(key: Key | undefined): string | null {
  return key ? Buffer.from(JSON.stringify(key)).toString("base64url") : null;
}

// Step 2: cursor -> key. The cursor comes from the client, so we treat it as untrusted input:
// it must decode to a flat object of strings/numbers, otherwise 400.
export function decodeCursor(cursor: string | undefined): Key | undefined {
  if (!cursor) return undefined;
  try {
    const key: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const valid =
      typeof key === "object" &&
      key !== null &&
      !Array.isArray(key) &&
      Object.values(key).every((v) => typeof v === "string" || typeof v === "number");
    if (valid) return key as Key;
  } catch {
    // fall through to the error below
  }
  throw badRequest("The cursor is not valid. Start again from the first page.");
}
