// MSW for Node (Vitest). The browser version (a service worker) is added for the E2E mock mode in M7.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
