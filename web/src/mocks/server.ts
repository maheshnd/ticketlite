// MSW for Node (Vitest). The browser version (a service worker) is mocks/browser.ts.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
