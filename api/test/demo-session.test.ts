// Session demo: the server-side session row decides, not the cookie alone.
import { DeleteCommand, DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const ddbMock = mockClient(DynamoDBDocumentClient);
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());
beforeEach(() => ddbMock.reset());

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("GET /api/demo/session/me", () => {
  it("returns the user for a live session", async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { sessionId: "s1", userId: "user-1", expiresAt: nowSeconds() + 60 } });
    const res = await app.inject({ url: "/api/demo/session/me", cookies: { sid: "s1" } });
    expect(res.json().userId).toBe("user-1");
  });

  it("returns 401 for an expired session that TTL has not deleted yet", async () => {
    ddbMock
      .on(GetCommand)
      .resolves({ Item: { sessionId: "s1", userId: "user-1", expiresAt: nowSeconds() - 1 } });
    const res = await app.inject({ url: "/api/demo/session/me", cookies: { sid: "s1" } });
    expect(res.statusCode).toBe(401);
  });

  it("logout deletes the row, so the same cookie stops working at once", async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const res = await app.inject({ method: "POST", url: "/api/demo/session/logout", cookies: { sid: "s1" } });
    expect(res.statusCode).toBe(204);
    expect(ddbMock.commandCalls(DeleteCommand)[0]!.args[0].input.Key).toEqual({ sessionId: "s1" });
  });
});
