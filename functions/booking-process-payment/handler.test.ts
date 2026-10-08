// ProcessPayment: the .13 rule declines; other amounts are charged.
import { describe, expect, it } from "vitest";
import { sagaInput } from "../shared/test-input";
import { handler } from "./handler";

describe("booking-process-payment", () => {
  it("declines amounts ending in .13 with a non-retryable PaymentDeclined error", async () => {
    await expect(handler({ ...sagaInput, amount: 20.13 })).rejects.toMatchObject({ name: "PaymentDeclined" });
  });

  it("returns a paymentId for other amounts", async () => {
    const result = await handler({ ...sagaInput, amount: 20.14 });
    expect(result.paymentId).toMatch(/^pay_bk-1_/);
  });
});
