// Event routes, tested through the real app with DynamoDB mocked by aws-sdk-client-mock.
// The mock intercepts every command the document client sends, so no AWS (or Docker) is needed.
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { sampleEvent } from "./fixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());
beforeEach(() => ddbMock.reset());

describe("GET /api/events", () => {
  it("queries the byStatus index when no city is given and returns a cursor", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [sampleEvent], LastEvaluatedKey: { eventId: "evt-1" } });

    const res = await app.inject({ url: "/api/events?limit=1" });

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().nextCursor).toEqual(expect.any(String));
    expect(ddbMock.commandCalls(QueryCommand)[0]!.args[0].input).toMatchObject({
      IndexName: "byStatus",
      Limit: 1,
    });
    expect(res.headers["cache-control"]).toBe("public, max-age=30");
  });

  it("queries the byCity index and filters out drafts when a city is given", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await app.inject({ url: "/api/events?city=Pune" });

    const input = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(input).toMatchObject({ IndexName: "byCity", FilterExpression: "#status = :published" });
  });

  it("returns 400 for a limit above 50", async () => {
    const res = await app.inject({ url: "/api/events?limit=500" });
    expect(res.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0); // validation runs before any database call
  });
});

describe("GET /api/events/:id", () => {
  it("returns the event with an ETag, then 304 when the client sends it back", async () => {
    ddbMock.on(GetCommand).resolves({ Item: sampleEvent });

    const first = await app.inject({ url: "/api/events/evt-1" });
    expect(first.statusCode).toBe(200);
    const etag = first.headers.etag as string;

    const second = await app.inject({ url: "/api/events/evt-1", headers: { "if-none-match": etag } });
    expect(second.statusCode).toBe(304);
    expect(second.body).toBe("");
  });

  it("returns 404 for a draft, exactly like for an unknown id", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...sampleEvent, status: "DRAFT" } });
    const res = await app.inject({ url: "/api/events/evt-1" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /partner/events", () => {
  it("returns the published events list (API Gateway has already checked the API key)", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [sampleEvent] });
    const res = await app.inject({ url: "/partner/events?limit=5" });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });
});
