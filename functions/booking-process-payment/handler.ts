// Saga step 2: ProcessPayment against a FAKE payment provider.
//   - Amounts ending in .13 are always declined: a deterministic way to see the compensation path.
//   - PAYMENT_FAILURE_RATE (0..1) makes the provider randomly "unavailable": a TRANSIENT error that the
//     state machine retries with exponential backoff.
// CONCEPT: saga, retries-backoff, circuit-breaker
import { createHmac } from "node:crypto";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { logger } from "../shared/powertools";
import { SagaError, type SagaInput } from "../shared/saga";
import { CircuitBreaker } from "./circuit-breaker";

const failureRate = Number(process.env.PAYMENT_FAILURE_RATE ?? "0");

// Module level: one breaker per Lambda copy, kept between invocations (see circuit-breaker.ts).
const breaker = new CircuitBreaker(3, 30_000);

// The provider's signing secret lives in Secrets Manager, never in code or env vars. Powertools Parameters
// caches it in memory for 5 minutes, so warm invocations don't call Secrets Manager every time.
// CONCEPT: secrets-management
async function signingSecret(): Promise<string | undefined> {
  const arn = process.env.PAYMENT_SECRET_ARN;
  if (!arn) return undefined;
  try {
    return await getSecret<string>(arn, { maxAge: 300 });
  } catch (error) {
    // The owner sets the value by hand after the first deploy (docs/CICD-SETUP.md). Until then: unsigned.
    logger.warn("payment signing secret not readable; charging unsigned (demo)", { error: error as Error });
    return undefined;
  }
}

// The fake provider. Real providers verify an HMAC signature of the request, and take bookingId as THEIR
// idempotency key, so our retries can never charge the card twice.
async function chargeCard(input: SagaInput): Promise<string> {
  if (Math.random() < failureRate) throw new SagaError("PaymentProviderUnavailable", "Provider timed out.");
  const secret = await signingSecret();
  const signature = secret
    ? createHmac("sha256", secret).update(`${input.bookingId}:${input.amount}`).digest("hex").slice(0, 12)
    : "unsigned";
  return `pay_${input.bookingId}_${signature}`;
}

export const handler = async (input: SagaInput): Promise<SagaInput> => {
  logger.appendKeys({ correlationId: input.correlationId, bookingId: input.bookingId });

  // Step 1: a business failure. Retrying won't help, so the state machine goes straight to compensation.
  if (Math.round(input.amount * 100) % 100 === 13) {
    throw new SagaError("PaymentDeclined", "Card declined (amount ends in .13).");
  }

  // Step 2: call the provider through the circuit breaker.
  const paymentId = await breaker.call(() => chargeCard(input));
  logger.info("payment captured", { paymentId, amount: input.amount });
  return { ...input, paymentId };
};
