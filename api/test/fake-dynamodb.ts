// A tiny in-memory stand-in for DynamoDB, enough for multi-step tests (idempotency replays, conditional puts).
// Only what the tests need: Put (with attribute_not_exists), Get, Update (marks fields), Delete. Query is
// mocked per test. Real behaviour is covered by the conditional-expression unit tests and the real deploy.
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

type Item = Record<string, unknown>;

// The partition key of each table (the local default table names from src/config.ts).
const KEY_NAMES: Record<string, string> = {
  Events: "eventId",
  Bookings: "bookingId",
  IdempotencyKeys: "key",
};

export function fakeDynamoDb() {
  const tables = new Map<string, Map<string, Item>>();
  const table = (name: string) => tables.get(name) ?? tables.set(name, new Map()).get(name)!;
  const id = (key: Item) => JSON.stringify(key);
  const keyOf = (tableName: string, item: Item) => ({ [KEY_NAMES[tableName]!]: item[KEY_NAMES[tableName]!] });

  const mock = mockClient(DynamoDBDocumentClient);
  mock.on(PutCommand).callsFake((input) => {
    const rows = table(input.TableName);
    const k = id(keyOf(input.TableName, input.Item));
    if (input.ConditionExpression?.startsWith("attribute_not_exists") && rows.has(k)) {
      throw new ConditionalCheckFailedException({ message: "exists", $metadata: {} });
    }
    rows.set(k, input.Item);
    return {};
  });
  mock.on(GetCommand).callsFake((input) => ({ Item: table(input.TableName).get(id(input.Key)) }));
  mock.on(UpdateCommand).callsFake((input) => {
    const rows = table(input.TableName);
    const current = rows.get(id(input.Key)) ?? { ...input.Key };
    // Apply the ":placeholder" values for "SET a = :a"-style assignments (enough for these tests).
    for (const part of String(input.UpdateExpression).replace("SET ", "").split(", ")) {
      const [left, right] = part.split(" = ");
      const field = left!.startsWith("#") ? input.ExpressionAttributeNames?.[left!] : left!;
      if (right?.startsWith(":") && field) current[field] = input.ExpressionAttributeValues?.[right];
    }
    rows.set(id(input.Key), current);
    return {};
  });
  mock.on(DeleteCommand).callsFake((input) => {
    table(input.TableName).delete(id(input.Key));
    return {};
  });

  return {
    mock,
    seed: (tableName: string, item: Item) => table(tableName).set(id(keyOf(tableName, item)), item),
  };
}
