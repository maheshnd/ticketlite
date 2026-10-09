// Post-deploy smoke tests against the REAL deployment (deploy.yml sets BASE_URL to the CloudFront URL).
// smoke.spec.ts is read-only. write-paths.spec.ts books a seat and uploads a poster with a dedicated smoke
// admin (it needs USER_POOL_ID + AWS credentials, and is skipped without them), so a missing IAM
// permission fails the deploy job instead of a user's first booking.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "smoke",
  retries: 2, // a freshly invalidated CloudFront can be briefly slow
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
