// Post-deploy smoke tests for the WRITE paths: a booking runs the whole saga, and a poster upload goes
// browser -> S3 (presigned POST) -> poster-processor. Unit tests mock AWS, so a missing IAM permission only
// shows up here, as a 403 or a booking stuck in FAILED, right after the deploy.
// They need AWS credentials allowed to manage the Cognito pool (deploy.yml: the deploy role) and USER_POOL_ID.
// Side effects, all small and reused: one smoke admin user, one smoke event (published only while the test
// runs), one seat per run, one tiny poster per run, and the usual confirmation + admin emails.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ensureSmokeAdmin, login, publishSmokeEvent, setStatus } from "./smoke-admin";

const userPoolId = process.env.USER_POOL_ID;
// A valid 1x1 PNG: poster-processor checks the real file type from the first bytes.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("write paths (booking saga, poster upload)", () => {
  test.skip(!userPoolId, "Set USER_POOL_ID (and AWS credentials) to run the write-path smoke tests.");

  test("a booking reaches CONFIRMED and a poster upload is attached", async ({ request }) => {
    test.setTimeout(120_000); // the saga retries payments with backoff; S3 -> Lambda is asynchronous

    // Step 1: a smoke admin + a published smoke event.
    const token = await login(request, await ensureSmokeAdmin(userPoolId!));
    const headers = { authorization: `Bearer ${token}` };
    const event = await publishSmokeEvent(request, token);

    try {
      // Step 2: book one seat. Needs the api role's DynamoDB writes (Bookings, IdempotencyKeys) and
      // states:StartExecution. A missing permission answers 500 here.
      const created = await request.post("/api/bookings", {
        headers: { ...headers, "idempotency-key": randomUUID() },
        data: { eventId: event.eventId, seats: 1 },
      });
      expect(created.status(), await created.text()).toBe(202);
      const { bookingId } = (await created.json()) as { bookingId: string };

      // Step 3: poll like the web app until the saga ends. CONFIRMED proves every saga Lambda's role works
      // (a failed step ends in FAILED, with the reason in failureReason).
      let booking = { status: "PENDING", failureReason: undefined as string | undefined };
      await expect
        .poll(
          async () => {
            const response = await request.get(`/api/bookings/${bookingId}`, { headers });
            booking = await response.json();
            return booking.status;
          },
          { timeout: 60_000, intervals: [1000] },
        )
        .not.toBe("PENDING");
      expect(booking.status, `failureReason: ${booking.failureReason}`).toBe("CONFIRMED");

      // Step 4: get a presigned POST and upload the file straight to S3, like the browser does.
      // S3 checks the api role's s3:PutObject here: AccessDenied answers 403.
      const presign = await request.post("/api/admin/uploads/poster", {
        headers,
        data: { eventId: event.eventId, contentType: "image/png" },
      });
      expect(presign.status(), await presign.text()).toBe(200);
      const { url, fields, key } = (await presign.json()) as {
        url: string;
        fields: Record<string, string>;
        key: string;
      };
      // The signed fields first, the file LAST (S3 ignores fields after the file).
      const upload = await request.post(url, {
        multipart: { ...fields, file: { name: "smoke.png", mimeType: "image/png", buffer: PNG } },
      });
      expect(upload.status(), await upload.text()).toBe(204);

      // Step 5: poster-processor (S3 GetObject + DynamoDB UpdateItem) attaches it to the event.
      await expect
        .poll(
          async () => {
            const response = await request.get(`/api/admin/events/${event.eventId}`, { headers });
            return ((await response.json()) as { posterKey?: string }).posterKey;
          },
          { timeout: 30_000, intervals: [1000] },
        )
        .toBe(key);
    } finally {
      // Step 6: hide the smoke event from the public list again (read first: we need its latest version).
      const latest = await request.get(`/api/admin/events/${event.eventId}`, { headers });
      await setStatus(request, token, await latest.json(), "DRAFT");
    }
  });
});
