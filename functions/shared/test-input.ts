// A sample saga input shared by the function tests.
import type { SagaInput } from "./saga";

export const sagaInput: SagaInput = {
  bookingId: "bk-1",
  eventId: "evt-1",
  userId: "user-1",
  eventName: "Comedy Night",
  seats: 2,
  amount: 998,
  correlationId: "corr-1",
};
