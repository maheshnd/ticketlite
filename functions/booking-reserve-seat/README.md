# booking-reserve-seat

Saga step 1 (`ReserveSeat` in `infra/booking-state-machine.asl.json`).

- **Trigger / invocation:** Step Functions task, synchronous (`lambda:invoke`).
- **Does:** one DynamoDB `TransactWriteItems`: `availableSeats -= seats` (only if enough seats and the event is
  published) + `seatReservedAt` on the booking (only if not set yet and the booking is PENDING).
- **Errors:** `SoldOut` (business: not retried, the saga marks the booking FAILED). Anything else is retried by
  the state machine (2 attempts, backoff).
- **Idempotent:** a retry after success finds `seatReservedAt` set and returns without changing anything.
- **IAM:** `dynamodb:UpdateItem` on the Events and Bookings tables (that's all `TransactWriteItems` needs).
