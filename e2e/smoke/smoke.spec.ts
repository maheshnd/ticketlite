// Post-deploy smoke tests through CloudFront: the web app, the API behind /api, security headers, a11y.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the API answers through CloudFront", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("the home page loads with security headers and no a11y violations", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["strict-transport-security"]).toBeTruthy();
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
