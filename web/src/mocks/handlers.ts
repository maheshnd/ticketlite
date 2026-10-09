// MSW request handlers: a fake TicketLite API that runs inside the test process (or, in the E2E mock mode,
// inside the browser via a service worker). Components make real fetch calls; MSW answers them.
// One file per API area; this file only combines them. CONCEPT: api-mocking
import { adminHandlers, resetAdminState } from "./admin-handlers";
import { appsyncHandlers } from "./appsync-handlers";
import { authHandlers, resetAuthState } from "./auth-handlers";
import { bookingHandlers } from "./booking-handlers";
import { eventHandlers } from "./event-handlers";

export { pushSeatUpdate } from "./appsync-handlers";

export const handlers = [
  ...appsyncHandlers,
  ...eventHandlers,
  ...authHandlers,
  ...bookingHandlers,
  ...adminHandlers,
];

// Runs after every unit test (src/test/setup.ts) so tests can't affect each other.
export function resetMockState() {
  resetAuthState();
  resetAdminState();
}
