// Admin routes: RBAC (admin group only) and optimistic locking (409 on a stale version).
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import * as jwt from "../src/lib/jwt";
import { sampleEvent } from "./fixtures";

vi.mock("../src/lib/jwt");
const ddbMock = mockClient(DynamoDBDocumentClient);
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());
beforeEach(() => {
  ddbMock.reset();
  vi.mocked(jwt.verifyAccessToken).mockResolvedValue({ sub: "admin-1", groups: ["admin"] });
});

const headers = { authorization: "Bearer t" };
const {
  eventId: _id,
  availableSeats: _a,
  version: _v,
  createdAt: _c,
  updatedAt: _u,
  posterKey: _p,
  ...newEvent
} = sampleEvent;

describe("admin events: access and create", () => {
  it("returns 403 for a logged-in user who is not in the admin group", async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({ sub: "user-1", groups: [] });
    const res = await app.inject({ method: "POST", url: "/api/admin/events", headers, payload: newEvent });
    expect(res.statusCode).toBe(403);
  });

  it("creates an event with version 1 and all seats available", async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await app.inject({ method: "POST", url: "/api/admin/events", headers, payload: newEvent });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ version: 1, availableSeats: newEvent.totalSeats });
  });
});

describe("admin events: optimistic locking", () => {
  it("returns 409 when the event version is stale", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...sampleEvent, version: 3 } });
    ddbMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: "stale", $metadata: {} }));
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/events/evt-1",
      headers,
      payload: { name: "New name", version: 2 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("sends the expected version and a relative seat change in ONE conditional update", async () => {
    ddbMock.on(GetCommand).resolves({ Item: sampleEvent }); // 100 total, 42 available
    ddbMock
      .on(UpdateCommand)
      .resolves({ Attributes: { ...sampleEvent, totalSeats: 110, availableSeats: 52, version: 2 } });
    await app.inject({
      method: "PUT",
      url: "/api/admin/events/evt-1",
      headers,
      payload: { totalSeats: 110, version: 1 },
    });
    const input = ddbMock.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(input.ConditionExpression).toContain("#version = :expected");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":expected": 1, ":delta": 10 });
  });
});

describe("admin events: seat changes", () => {
  it("refuses to cut totalSeats below the seats already sold", async () => {
    ddbMock.on(GetCommand).resolves({ Item: sampleEvent }); // 58 sold
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/events/evt-1",
      headers,
      payload: { totalSeats: 50, version: 1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("admin poster uploads", () => {
  it("presigns a poster upload limited to the declared type and 2 MB", async () => {
    ddbMock.on(GetCommand).resolves({ Item: sampleEvent });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/uploads/poster",
      headers,
      payload: { eventId: "evt-1", contentType: "image/png" },
    });
    expect(res.statusCode).toBe(200);
    const { key, fields } = res.json();
    expect(key).toMatch(/^posters\/evt-1\/[0-9a-f-]+\.png$/);
    const policy = JSON.parse(Buffer.from(fields.Policy, "base64").toString());
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 2 * 1024 * 1024]);
  });
});

describe("GET /api/admin/reports", () => {
  it("answers 404 with an explanation when SQL reporting is off", async () => {
    const res = await app.inject({ url: "/api/admin/reports", headers });
    expect(res.statusCode).toBe(404);
    expect(res.json().detail).toContain("enableSql");
  });
});
