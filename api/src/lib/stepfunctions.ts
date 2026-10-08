// Starts the booking saga (Step Functions). The client is created once per Lambda copy.
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { config } from "../config";

const client = new SFNClient({
  region: config.region,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 1000, requestTimeout: 2000 }), // CONCEPT: timeout-chain
});

// The execution NAME is the bookingId. Names are unique per state machine (for 90 days), so even a buggy
// double call can never start two sagas for one booking. CONCEPT: idempotency
export async function startBookingSaga(bookingId: string, input: object): Promise<string> {
  const result = await client.send(
    new StartExecutionCommand({
      stateMachineArn: config.bookingStateMachineArn,
      name: bookingId,
      input: JSON.stringify(input),
    }),
  );
  return result.executionArn!;
}
