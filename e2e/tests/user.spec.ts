// A user signs up, confirms, logs in, books seats and follows the booking to "Confirmed".
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";

test("signs up and confirms the email", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true"); // accessible validation
  await expectNoA11yViolations(page);

  await page.getByLabel("Email").fill("new@ticketlite.dev");
  await page.getByLabel(/^Password/).fill("Tickets2026x");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/confirm\?email=new%40ticketlite.dev/);

  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/login\?confirmed=1/);
});

test("logs in, books two seats and sees the booking confirmed", async ({ page }) => {
  await page.goto("/login");
  await expectNoA11yViolations(page);
  await page.getByLabel("Email").fill("test@ticketlite.dev");
  await page.getByLabel("Password").fill("Tickets2026x");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.getByRole("link", { name: "Event 1", exact: true }).click();
  await page.getByLabel("Seats").selectOption("2");
  await page.getByRole("button", { name: "Book" }).click();

  await expect(page).toHaveURL(/\/booking\?id=bk-1/);
  await expect(page.getByRole("status").filter({ hasText: "Confirmed! Enjoy the show." })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "All my bookings" }).click();
  await expect(page.getByRole("list", { name: "My bookings" })).toContainText("Event 1");
});
