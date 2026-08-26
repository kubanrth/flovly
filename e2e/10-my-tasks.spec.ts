import { test, expect } from "./fixtures/console-errors";

// Nagłówki grup zmienione w F4 (D2): Zaległe/Na dziś/Nadchodzące/Bez terminu →
// Po terminie/Ten tydzień/Później (+ Bez terminu gdy takie zadania są).
test.describe("my-tasks (F12-K91 regression)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my-tasks");
  });

  test("renders the due-date groups", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /po terminie/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /ten tydzień/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /później/i })).toBeVisible();
    // reset-fixtures parkuje jedno zadanie bez terminu.
    await expect(page.getByRole("heading", { name: /bez terminu/i })).toBeVisible();
  });

  test("done tasks do NOT appear in Po terminie (F12-K91)", async ({ page }) => {
    const overdueHeading = page.getByRole("heading", { name: /po terminie/i });
    await expect(overdueHeading).toBeVisible();
    // Każda grupa to <section> z własnym h2 (my-tasks-view.tsx).
    const section = page.locator("section").filter({ has: overdueHeading });
    await expect(section).toHaveCount(1);
    await expect(section.getByText(/^(zrobione|done)$/i)).toHaveCount(0);
  });
});
