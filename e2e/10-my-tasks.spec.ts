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
    const overdueHeading = page.getByRole("heading", { name: /zaległe/i });
    await expect(overdueHeading).toBeVisible();
    // Each bucket is a <section> with its own h2 (hotkey-task-list.tsx).
    const section = page.locator("section").filter({ has: overdueHeading });
    await expect(section).toHaveCount(1);
    await expect(section.getByText(/^(zrobione|done)$/i)).toHaveCount(0);
  });
});
