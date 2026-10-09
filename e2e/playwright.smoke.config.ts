// Post-deploy smoke tests against the REAL deployment (deploy.yml sets BASE_URL to the CloudFront URL).
// Read-only checks: nothing is created, so they are safe to run against any environment.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "smoke",
  retries: 2, // a freshly invalidated CloudFront can be briefly slow
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
