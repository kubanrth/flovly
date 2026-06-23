import { test, expect } from "./fixtures/console-errors";

test.describe("my-tasks (F12-K91 regression)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my-tasks");
  });

  test("renders all 4 sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /zaległe/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /na dziś/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /nadchodzące/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /bez terminu/i })).toBeVisible();
  });

  test("done tasks do NOT appear in Zaległe (F12-K91)", async ({ page }) => {
    // The "Zaległe" section should contain only non-done tasks. We assert
    // no row within that section has a "Done"/"Zrobione" status badge.
    const overdueHeading = page.getByRole("heading", { name: /zaległe/i });
    if (!(await overdueHeading.isVisible().catch(() => false))) {
      test.skip(true, "no overdue section");
    }
    // Get the section container (parent / next sibling). Safer: scope to
    // a section whose accessible name matches "Zaległe".
    const section = page.locator("section, div").filter({ has: overdueHeading }).first();
    const doneBadges = section.getByText(/^zrobione$|^done$/i);
    expect(await doneBadges.count()).toBe(0);
  });
});
