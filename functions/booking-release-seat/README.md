# booking-release-seat

Saga compensation (`ReleaseSeat`): undoes `ReserveSeat` after a payment failure.

- **Trigger / invocation:** Step Functions task, synchronous (from the `Catch` on `ProcessPayment`).
- **Does:** one transaction: `availableSeats += seats` + booking → FAILED with `failureReason`, only if the
  booking is still PENDING and holds seats.
- **Errors:** retried by the state machine (3 attempts). If it still fails the execution FAILS, which raises an
  alarm (M6): seats stuck in a failed booking need a human.
- **Idempotent:** a retry finds the booking FAILED, the transaction is cancelled, seats are not given back twice.
- **IAM:** `dynamodb:UpdateItem` on the Events and Bookings tables.
