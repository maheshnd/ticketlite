# booking-confirm

Saga step 3 (`ConfirmBooking`).

- **Trigger / invocation:** Step Functions task, synchronous.
- **Does:** booking PENDING → CONFIRMED (+ `paymentId`). Then publishes the live seat count to AppSync and
  `BookingConfirmed` to EventBridge.
- **Errors:** retried by the state machine. Already CONFIRMED = success (idempotent).
- **IAM:** `dynamodb:UpdateItem` on the Bookings table.
