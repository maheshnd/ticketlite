// email-worker: one email per booking, even if SQS delivers the message twice; failures are reported per message.
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESv2Client);
beforeEach(() => {
  ddbMock.reset();
  sesMock.reset();
  ddbMock.on(UpdateCommand).resolves({});
  sesMock.on(SendEmailCommand).resolves({});
});

const message = (id: string, bookingId: string) => ({
  messageId: id,
  body: JSON.stringify({
    detail: { bookingId, eventName: "Jazz", seats: 2, amount: 998, correlationId: "c" },
  }),
});

describe("email-worker", () => {
  it("sends the email and marks the booking", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { bookingId: "bk-1" } });
    const result = await handler({ Records: [message("m1", "bk-1")] } as never);
    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(result.batchItemFailures).toEqual([]);
  });

  it("does not send twice when the marker is already set (duplicate delivery)", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { bookingId: "bk-1", emailSentAt: "2026-10-08T10:00:00Z" } });
    await handler({ Records: [message("m1", "bk-1")] } as never);
    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
  });

  it("returns only the failed message ids (partial batch response)", async () => {
    ddbMock.on(GetCommand).resolves({ Item: {} });
    sesMock.on(SendEmailCommand).rejectsOnce(new Error("throttled")).resolves({});
    const result = await handler({ Records: [message("m1", "bk-1"), message("m2", "bk-2")] } as never);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "m1" }]);
  });
});
