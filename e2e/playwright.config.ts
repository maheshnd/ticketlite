// Playwright for the E2E journeys: the static web build in MOCK mode (MSW in the browser), served locally
// with the CloudFront rewrite. No AWS needed. Build it first: pnpm --filter @ticketlite/e2e build:mock
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node serve.mjs", port: 4173, reuseExistingServer: !process.env.CI },
});
