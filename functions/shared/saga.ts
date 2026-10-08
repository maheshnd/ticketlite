// The data passed between the booking saga's steps (the Step Functions execution input).
// The API builds it when it starts the execution; every step receives it and passes it on.
export type SagaInput = {
  bookingId: string;
  eventId: string;
  userId: string;
  seats: number;
  amount: number;
  correlationId: string; // the API request's id, so one search finds API + saga logs. CONCEPT: correlation-id
  paymentId?: string; // added by ProcessPayment
  error?: { Error: string; Cause?: string }; // added by a Catch when a step failed
};

// Errors a step throws ON PURPOSE. Step Functions matches Retry/Catch rules on the error's `name`.
export class SagaError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}
