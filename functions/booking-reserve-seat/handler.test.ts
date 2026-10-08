// ReserveSeat: atomic, never oversells, and safe to retry.
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { sagaInput } from "../shared/test-input";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

const cancelled = (eventCode: string, bookingCode: string) =>
  new TransactionCanceledException({
    message: "Transaction cancelled",
    $metadata: {},
    CancellationReasons: [{ Code: eventCode }, { Code: bookingCode }],
  });

describe("booking-reserve-seat", () => {
  it("decrements seats and marks the booking in ONE transaction", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await expect(handler(sagaInput)).resolves.toEqual(sagaInput);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(items).toHaveLength(2);
    expect(items[0]!.Update!.ConditionExpression).toContain("availableSeats >= :seats");
  });

  it("throws SoldOut when the event has too few seats", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled("ConditionalCheckFailed", "None"));
    await expect(handler(sagaInput)).rejects.toMatchObject({ name: "SoldOut" });
  });

  it("succeeds without changing anything when a retry finds the seat already reserved", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled("None", "ConditionalCheckFailed"));
    await expect(handler(sagaInput)).resolves.toEqual(sagaInput);
  });
});
