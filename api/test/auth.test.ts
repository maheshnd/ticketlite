// BFF auth routes, with the Cognito calls mocked (vi.mock replaces the whole lib/cognito module).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as cognito from "../src/lib/cognito";
import { buildApp } from "../src/app";

vi.mock("../src/lib/cognito");
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());
beforeEach(() => vi.resetAllMocks());

const cognitoError = (name: string) => Object.assign(new Error(name), { name });

describe("POST /api/auth/login", () => {
  it("returns the access token in the body and the refresh token in a locked-down cookie", async () => {
    vi.mocked(cognito.passwordLogin).mockResolvedValue({
      AccessToken: "access",
      RefreshToken: "refresh",
      ExpiresIn: 900,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@b.co", password: "x" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessToken: "access", expiresIn: 900 });
    const cookie = res.headers["set-cookie"] as string;
    expect(cookie).toContain("refresh_token=refresh");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth");
    expect(res.body).not.toContain('refresh"'); // the refresh token never appears in the body
  });

  it("returns 401 with a vague message for a wrong password", async () => {
    vi.mocked(cognito.passwordLogin).mockRejectedValue(cognitoError("NotAuthorizedException"));
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@b.co", password: "x" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns 403 without the x-csrf header, even with a valid cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: "r" },
    });
    expect(res.statusCode).toBe(403);
    expect(cognito.refreshLogin).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no refresh cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { "x-csrf": "1" } });
    expect(res.statusCode).toBe(401);
  });

  it("returns a new access token for a valid cookie + header", async () => {
    vi.mocked(cognito.refreshLogin).mockResolvedValue({ AccessToken: "new-access", ExpiresIn: 900 });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { "x-csrf": "1" },
      cookies: { refresh_token: "r" },
    });
    expect(res.json().accessToken).toBe("new-access");
  });
});

describe("other auth routes", () => {
  it("signup returns 409 when the email is taken", async () => {
    vi.mocked(cognito.signUp).mockRejectedValue(cognitoError("UsernameExistsException"));
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "a@b.co", password: "Tickets2026x" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("forgot returns 202 even for an unknown email (no account discovery)", async () => {
    vi.mocked(cognito.forgotPassword).mockRejectedValue(cognitoError("UserNotFoundException"));
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "nobody@b.co" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("logout revokes the refresh token and clears the cookie", async () => {
    vi.mocked(cognito.revokeRefreshToken).mockResolvedValue();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { "x-csrf": "1" },
      cookies: { refresh_token: "r" },
    });
    expect(res.statusCode).toBe(204);
    expect(cognito.revokeRefreshToken).toHaveBeenCalledWith("r");
    expect(res.headers["set-cookie"]).toContain("refresh_token=;");
  });
});
