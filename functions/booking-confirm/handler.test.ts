// ConfirmBooking: PENDING -> CONFIRMED, and a retry is harmless.
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { sagaInput } from "../shared/test-input";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

describe("booking-confirm", () => {
  it("confirms a pending booking", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    await handler({ ...sagaInput, paymentId: "pay_1" });
    const input = ddbMock.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(input.ExpressionAttributeValues![":confirmed"]).toBe("CONFIRMED");
    expect(input.ConditionExpression).toBe("#status = :pending");
  });

  it("treats an already-confirmed booking as success", async () => {
    ddbMock.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: "x", $metadata: {} }));
    await expect(handler(sagaInput)).resolves.toEqual(sagaInput);
  });
});
