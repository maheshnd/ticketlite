// Runs before every web test file.
import "@testing-library/jest-dom/vitest"; // adds matchers like toBeInTheDocument(), toHaveAttribute()
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setAccessToken } from "../lib/token-store";
import { resetMockState } from "../mocks/handlers";
import { server } from "../mocks/server";

// Step 1: start the fake API. "error" makes any request WITHOUT a handler fail the test loudly.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

// Step 2: reset everything between tests so tests can't affect each other.
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockState();
  setAccessToken(null);
});

// Step 3: jsdom has no IntersectionObserver (used by infinite scroll). A no-op stand-in is enough:
// tests use the "Load more" button instead.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  },
);
