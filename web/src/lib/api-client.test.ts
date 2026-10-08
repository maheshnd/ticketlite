// apiFetch: an expired access token is refreshed once and the request retried.
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { ApiError, apiFetch } from "./api-client";
import { getAccessToken, setAccessToken } from "./token-store";

describe("apiFetch", () => {
  it("refreshes the token after a 401 and retries the request with the new one", async () => {
    setAccessToken("expired-token");
    server.use(
      http.get("*/api/me", ({ request }) =>
        request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json({ userId: "user-1" })
          : HttpResponse.json({ title: "Unauthorized", status: 401, detail: "expired" }, { status: 401 }),
      ),
      http.post("*/api/auth/refresh", ({ request }) =>
        request.headers.get("x-csrf") === "1"
          ? HttpResponse.json({ accessToken: "fresh-token", expiresIn: 900 })
          : new HttpResponse(null, { status: 403 }),
      ),
    );

    await expect(apiFetch("/api/me")).resolves.toEqual({ userId: "user-1" });
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("turns a problem+json response into an ApiError", async () => {
    const error = await apiFetch("/api/events/nope").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});
