// Booking routes: idempotent creation, ownership checks, early seat check.
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { tooManyRequests } from "../src/errors";
import * as jwt from "../src/lib/jwt";
import * as rateLimit from "../src/services/rate-limit-service";
import { fakeDynamoDb } from "./fake-dynamodb";
import { sampleEvent } from "./fixtures";

vi.mock("../src/lib/jwt");
const sfnMock = mockClient(SFNClient);
let db: ReturnType<typeof fakeDynamoDb>;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(() => app.close());
beforeEach(() => {
  db = fakeDynamoDb();
  db.seed("Events", sampleEvent);
  sfnMock.reset();
  sfnMock.on(StartExecutionCommand).resolves({ executionArn: "arn:aws:states:::execution:booking:x" });
  vi.mocked(jwt.verifyAccessToken).mockResolvedValue({ sub: "user-1", groups: [] });
});

const book = (key: string | undefined, seats = 2) =>
  app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: { authorization: "Bearer t", ...(key ? { "idempotency-key": key } : {}) },
    payload: { eventId: "evt-1", seats },
  });

describe("POST /api/bookings", () => {
  it("returns 400 without an Idempotency-Key header", async () => {
    expect((await book(undefined)).statusCode).toBe(400);
  });

  it("creates a PENDING booking, starts the saga named after it, and answers 202 + Location", async () => {
    const res = await book("key-00000001");
    expect(res.statusCode).toBe(202);
    const { bookingId } = res.json();
    expect(res.headers.location).toBe(`/api/bookings/${bookingId}`);
    const start = sfnMock.commandCalls(StartExecutionCommand)[0]!.args[0].input;
    expect(start.name).toBe(bookingId);
    expect(JSON.parse(start.input!)).toMatchObject({ bookingId, seats: 2, amount: 998, userId: "user-1" });
  });

  it("replays the first response for a retry with the same key, without a second saga", async () => {
    const first = await book("key-00000002");
    const retry = await book("key-00000002");
    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toEqual(first.json());
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(sfnMock.commandCalls(StartExecutionCommand)).toHaveLength(1);
  });

  it("returns 422 when the same key is reused for a different request", async () => {
    await book("key-00000003", 2);
    expect((await book("key-00000003", 3)).statusCode).toBe(422);
  });

  it("returns 409 straight away when there are obviously not enough seats", async () => {
    expect((await book("key-00000004", 6)).statusCode).toBe(202); // 42 seats left: fine
    db.seed("Events", { ...sampleEvent, availableSeats: 1 });
    expect((await book("key-00000005", 2)).statusCode).toBe(409);
  });
});

describe("rate limiting", () => {
  it("answers 429 with Retry-After and starts no saga when the user books too often", async () => {
    vi.spyOn(rateLimit, "checkBookingRateLimit").mockRejectedValueOnce(tooManyRequests(42));
    const res = await book("key-00000006");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("42");
    expect(sfnMock.commandCalls(StartExecutionCommand)).toHaveLength(0);
  });
});

describe("GET /api/bookings/:id", () => {
  it("returns 404 (not 403) for someone else's booking, so ids can't be probed", async () => {
    db.seed("Bookings", { bookingId: "bk-9", userId: "user-2", status: "PENDING" });
    const res = await app.inject({ url: "/api/bookings/bk-9", headers: { authorization: "Bearer t" } });
    expect(res.statusCode).toBe(404);
  });
});
