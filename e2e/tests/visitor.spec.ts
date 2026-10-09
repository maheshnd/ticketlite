// A visitor (not logged in) browses, opens an event, watches live seats and searches. Plus axe on each page.
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";

test("browses the list, opens an event and sees live seat counts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Events" }).getByRole("listitem")).toHaveCount(12);
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: "Event 1", exact: true }).click();
  await expect(page).toHaveURL(/\/event\?id=evt-001/);
  await expect(page.getByRole("heading", { name: "Event 1" })).toBeVisible();
  await expect(page.getByText("40 of 100 seats left")).toBeVisible();
  await expect(page.getByText("Organized by Live Nation India")).toBeVisible(); // AppSync query (mocked)
  await expect(page.getByRole("link", { name: "Log in to book" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("loads more events and filters by city", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("link", { name: "Event 15" })).toBeVisible();

  await page.getByLabel("City").fill("Pune");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByRole("link", { name: "Event 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Event 2", exact: true })).toHaveCount(0);
});

test("searches with the city aggregation", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("Search events").fill("event 1");
  await expect(page.getByText("7 results")).toBeVisible(); // Event 1, 10-15
  await page.getByRole("group", { name: "Filter by city" }).getByRole("button", { name: /^Pune/ }).click();
  await expect(page.getByRole("list", { name: "Search results" }).getByRole("listitem")).toHaveCount(3);
  await expectNoA11yViolations(page);
});

test("an unknown page gets the 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("the learn page lists the study material", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Learn how TicketLite works" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Concept map/ })).toHaveAttribute(
    "href",
    /docs\/CONCEPT-MAP\.md$/,
  );
  await expectNoA11yViolations(page);
});
