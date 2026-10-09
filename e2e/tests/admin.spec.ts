// An admin creates an event and publishes/unpublishes from the list.
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";

test("creates an event and toggles its status", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@ticketlite.dev");
  await page.getByLabel("Password").fill("Tickets2026x");
  await page.getByRole("button", { name: "Log in" }).click();

  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Manage events" })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Name").fill("Playwright Live");
  await page.getByLabel("Description").fill("Created by an end-to-end test");
  await page.getByLabel("City").fill("Pune");
  await page.getByLabel("Venue").fill("Test Hall");
  await page.getByLabel("Starts at (UTC)").fill("2027-05-01T19:00");
  await page.getByLabel("Price (INR)").fill("750");
  await page.getByLabel("Total seats").fill("80");
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page.getByRole("link", { name: "Playwright Live" })).toBeVisible();
  await page.getByRole("button", { name: "Publish Playwright Live" }).click();
  await expect(page.getByRole("button", { name: "Unpublish Playwright Live" })).toBeVisible();
});
