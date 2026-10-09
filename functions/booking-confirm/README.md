# booking-confirm

Saga step 3 (`ConfirmBooking`).

- **Trigger / invocation:** Step Functions task, synchronous.
- **Does:** booking PENDING → CONFIRMED (+ `paymentId`). Then publishes the live seat count to AppSync and
  `BookingConfirmed` to EventBridge.
- **Errors:** retried by the state machine. Already CONFIRMED = success (idempotent).
- **IAM** (`infra/stepfunctions.ts`): `dynamodb:UpdateItem` on Bookings (PENDING → CONFIRMED); for the
  announcement (`functions/shared/announce.ts`): `dynamodb:GetItem` on Events (new seat count), `appsync:GraphQL` on
  the `Mutation.publishSeatUpdate` field only, `events:PutEvents` on the ticketlite bus. Plus logs + X-Ray.
