// GET /api/me: authentication via the access token (JWT verification mocked).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import * as cognito from "../src/lib/cognito";
import * as jwt from "../src/lib/jwt";

vi.mock("../src/lib/jwt");
vi.mock("../src/lib/cognito");
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());

describe("GET /api/me", () => {
  it("returns 401 without a token", async () => {
    const res = await app.inject({ url: "/api/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the token does not verify", async () => {
    vi.mocked(jwt.verifyAccessToken).mockRejectedValue(new Error("expired"));
    const res = await app.inject({ url: "/api/me", headers: { authorization: "Bearer bad" } });
    expect(res.statusCode).toBe(401);
  });

  it("returns the user and groups for a valid token", async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({ sub: "user-1", groups: ["admin"] });
    vi.mocked(cognito.getUserEmail).mockResolvedValue("a@b.co");
    const res = await app.inject({ url: "/api/me", headers: { authorization: "Bearer good" } });
    expect(res.json()).toEqual({ userId: "user-1", email: "a@b.co", groups: ["admin"] });
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });
});
