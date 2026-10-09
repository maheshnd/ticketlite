# booking-process-payment

Saga step 2 (`ProcessPayment`). A FAKE payment provider.

- **Trigger / invocation:** Step Functions task, synchronous.
- **Does:** declines amounts ending in `.13` (`PaymentDeclined`); otherwise "charges" through an in-memory
  circuit breaker. `PAYMENT_FAILURE_RATE` (0..1) simulates an unavailable provider.
- **Errors:** `PaymentDeclined` → straight to compensation. `PaymentProviderUnavailable` → retried 3 times with
  exponential backoff + jitter (1s, 2s, 4s). `CircuitOpen` → retried once after 5s. Still failing →
  compensation (`ReleaseSeat`).
- **Circuit breaker trade-off:** state is per Lambda copy (see `circuit-breaker.ts`).
- **IAM** (`infra/stepfunctions.ts`): `secretsmanager:GetSecretValue` on the payment signing secret only (read with
  Powertools `getSecret`, cached 5 min). The fake provider itself makes no AWS calls. Plus logs + X-Ray.
