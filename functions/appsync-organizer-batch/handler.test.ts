// The batch resolver: one DynamoDB call for many events, answers in the original order.
import { BatchGetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { describe, expect, it } from "vitest";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("appsync-organizer-batch", () => {
  it("fetches each organizer once and answers every payload in order", async () => {
    ddbMock.on(BatchGetCommand).resolves({
      Responses: {
        Organizers: [
          { organizerId: "org-1", name: "A" },
          { organizerId: "org-2", name: "B" },
        ],
      },
    });

    const result = await handler([
      { organizerId: "org-2" },
      { organizerId: "org-1" },
      { organizerId: "org-2" },
      { organizerId: "nope" },
    ]);

    expect(result).toEqual([
      { organizerId: "org-2", name: "B" },
      { organizerId: "org-1", name: "A" },
      { organizerId: "org-2", name: "B" },
      null,
    ]);
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(1);
    expect(
      ddbMock.commandCalls(BatchGetCommand)[0]!.args[0].input.RequestItems!.Organizers!.Keys,
    ).toHaveLength(3);
  });
});
