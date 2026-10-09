// Helpers for the write-path smoke test: a dedicated smoke admin user and a dedicated smoke event.
// The user is managed with Cognito ADMIN APIs, called with the CI deploy role's credentials (never by a
// Lambda). Its password is new and random on every run, so no password is stored anywhere.
import { randomUUID } from "node:crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { expect, type APIRequestContext } from "@playwright/test";

export const SMOKE_EMAIL = "smoke-test@example.com"; // never receives mail: Cognito sends nothing (SUPPRESS)
const SMOKE_EVENT_NAME = "Smoke test (automated)";

type SmokeEvent = { eventId: string; status: "DRAFT" | "PUBLISHED"; version: number; posterKey?: string };

// Step 1: make sure the smoke user exists, is an admin, and has a fresh password. Returns the password.
export async function ensureSmokeAdmin(userPoolId: string): Promise<string> {
  const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const password = `Smoke-${randomUUID()}`; // has lower, upper and digits, longer than 10 (the pool policy)
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: SMOKE_EMAIL,
        MessageAction: "SUPPRESS", // no invitation email
        UserAttributes: [
          { Name: "email", Value: SMOKE_EMAIL },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );
  } catch (error) {
    if (!(error instanceof UsernameExistsException)) throw error; // created by an earlier run: fine
  }
  // Permanent = no "change your password" challenge at login.
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: SMOKE_EMAIL,
      Password: password,
      Permanent: true,
    }),
  );
  await cognito.send(
    new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: SMOKE_EMAIL, GroupName: "admin" }),
  );
  return password;
}

// Step 2: log in through the real API (BFF -> Cognito InitiateAuth) and return an access token.
export async function login(request: APIRequestContext, password: string): Promise<string> {
  const response = await request.post("/api/auth/login", { data: { email: SMOKE_EMAIL, password } });
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

// Step 3: find the smoke event (created once, then reused on every deploy) and publish it, so it can be
// booked. Far in the future and with plenty of seats; it is set back to DRAFT at the end of the test.
export async function publishSmokeEvent(request: APIRequestContext, token: string): Promise<SmokeEvent> {
  const headers = { authorization: `Bearer ${token}` };
  const list = await request.get("/api/admin/events", { headers });
  expect(list.status(), await list.text()).toBe(200);
  const existing = ((await list.json()) as { items: Array<SmokeEvent & { name: string }> }).items.find(
    (e) => e.name === SMOKE_EVENT_NAME,
  );

  if (!existing) {
    const created = await request.post("/api/admin/events", {
      headers,
      data: {
        name: SMOKE_EVENT_NAME,
        description: "Created by the post-deploy smoke tests (e2e/smoke). Safe to ignore.",
        city: "Smoketown",
        venue: "CI runner",
        startsAt: "2099-12-31T18:00:00.000Z",
        price: 1, // never ends in .13, the fake provider's "decline" amount
        totalSeats: 100_000,
        organizerId: "org-1",
        status: "PUBLISHED",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    return (await created.json()) as SmokeEvent;
  }
  return existing.status === "PUBLISHED" ? existing : setStatus(request, token, existing, "PUBLISHED");
}

// PUT with the current version (optimistic locking).
export async function setStatus(
  request: APIRequestContext,
  token: string,
  event: SmokeEvent,
  status: SmokeEvent["status"],
): Promise<SmokeEvent> {
  const response = await request.put(`/api/admin/events/${event.eventId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status, version: event.version },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as SmokeEvent;
}
