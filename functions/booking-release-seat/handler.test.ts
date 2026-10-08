// ReleaseSeat (compensation): gives seats back once, never twice.
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { sagaInput } from "../shared/test-input";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => {
  ddbMock.reset();
  // The step reads the new seat count for the live update (skipped in tests: APPSYNC_URL is not set).
  ddbMock.on(GetCommand).resolves({ Item: { availableSeats: 40 } });
});

describe("booking-release-seat", () => {
  it("adds the seats back and records why the booking failed", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await handler({ ...sagaInput, error: { Error: "PaymentDeclined" } });
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(items[0]!.Update!.UpdateExpression).toContain("availableSeats + :seats");
    expect(items[1]!.Update!.ExpressionAttributeValues![":reason"]).toBe("PaymentDeclined");
  });

  it("does nothing on a retry after the seats were already released", async () => {
    ddbMock
      .on(TransactWriteCommand)
      .rejects(new TransactionCanceledException({ message: "x", $metadata: {}, CancellationReasons: [] }));
    await expect(handler(sagaInput)).resolves.toEqual(sagaInput);
  });
});
