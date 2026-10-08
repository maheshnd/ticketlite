// DynamoDB access for the Sessions table (session-vs-JWT demo only).
// Access patterns: create a session, get it by id, delete it (logout). CONCEPT: repository-pattern
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../config";
import { ddb } from "../lib/dynamodb";

const TableName = config.tables.sessions;

export type Session = {
  sessionId: string;
  userId: string;
  expiresAt: number; // epoch SECONDS: the format DynamoDB TTL requires. CONCEPT: ttl
};

export async function putSession(session: Session) {
  await ddb.send(new PutCommand({ TableName, Item: session }));
}

// Strongly consistent: right after logout (DeleteItem) the session must be gone, not "gone in a second".
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const result = await ddb.send(new GetCommand({ TableName, Key: { sessionId }, ConsistentRead: true }));
  return result.Item as Session | undefined;
}

export async function deleteSession(sessionId: string) {
  await ddb.send(new DeleteCommand({ TableName, Key: { sessionId } }));
}
