// Search with OpenSearch OFF: the DynamoDB fallback still answers, and says so.
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { sampleEvent } from "./fixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());

describe("GET /api/search (fallback)", () => {
  it("matches every word in memory, counts cities and reports the source", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [sampleEvent, { ...sampleEvent, eventId: "evt-2", name: "Jazz Night", city: "Mumbai" }],
    });
    const res = await app.inject({ url: "/api/search?q=comedy%20night" });
    expect(res.json()).toMatchObject({
      source: "dynamodb-fallback",
      total: 1,
      cities: [{ city: "Pune", count: 1 }],
    });
  });

  it("rejects an empty query", async () => {
    expect((await app.inject({ url: "/api/search?q=" })).statusCode).toBe(400);
  });
});
