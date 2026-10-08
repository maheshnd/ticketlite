// Unit tests for the resolvers' request/response logic (with @aws-appsync/utils faked).
import type { Context } from "@aws-appsync/utils";
import { describe, expect, it, vi } from "vitest";
import * as checkAdmin from "./fn-check-admin";
import * as updateEvent from "./fn-update-event";
import * as queryEvent from "./query-event";
import * as queryEvents from "./query-events";

vi.mock("@aws-appsync/utils", async () => (await import("./test-utils")).fakeUtils());
const ctx = (fields: Partial<Context>) => fields as Context;

describe("fn-check-admin", () => {
  it("lets admins through", () => {
    expect(checkAdmin.request(ctx({ identity: { groups: ["admin"] } as never }))).toEqual({ payload: null });
  });
  it("rejects everyone else", () => {
    expect(() => checkAdmin.request(ctx({ identity: { groups: [] } as never }))).toThrow("Unauthorized");
  });
});

describe("fn-update-event", () => {
  it("only sets the fields that were sent, bumps the version and checks the expected one", () => {
    const req = updateEvent.request(
      ctx({ args: { id: "evt-1", input: { name: "New", price: null, version: 4 } } }),
    );
    expect(req.update.expression).toBe("SET #version = #version + :one, updatedAt = :now, #name = :name");
    expect(req.update.expressionValues).toMatchObject({ ":expected": 4, ":name": "New" });
    expect(req.condition.expression).toBe("#version = :expected");
  });
  it("turns a failed condition into a ConflictError", () => {
    const res = () =>
      updateEvent.response(
        ctx({ error: { message: "x", type: "DynamoDB:ConditionalCheckFailedException" } }),
      );
    expect(res).toThrow(expect.objectContaining({ type: "ConflictError" }));
  });
});

describe("query-events / query-event", () => {
  it("uses the byCity index with a status filter when a city is given", () => {
    const req = queryEvents.request(ctx({ args: { city: "Pune", limit: 500 } }));
    expect(req).toMatchObject({ index: "byCity", limit: 50 });
    expect(req.filter?.expression).toBe("#status = :published");
  });
  it("hides drafts", () => {
    expect(queryEvent.response(ctx({ result: { status: "DRAFT" } }))).toBeNull();
  });
});
