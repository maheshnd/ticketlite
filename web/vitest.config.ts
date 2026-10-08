// Vitest for web/: component tests in a simulated browser (jsdom), with the API mocked by MSW.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Node's fetch needs absolute URLs, so tests call the API at this (mocked) origin.
    env: { NEXT_PUBLIC_API_URL: "http://localhost:3000" },
  },
});
