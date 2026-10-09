// MSW in the BROWSER (a service worker): used only by the E2E "mock mode" build (NEXT_PUBLIC_MOCK=1), so
// Playwright can run every journey without AWS. The same handlers as the unit tests.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
