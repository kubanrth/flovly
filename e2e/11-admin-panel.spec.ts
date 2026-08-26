import { test, expect } from "./fixtures/console-errors";

// Seed admin is super admin — /admin/* must respond 200.
test.describe("admin panel", () => {
  test("admin home shows 4 stat cards of equal height (F12-K100)", async ({ page }) => {
    const resp = await page.goto("/admin");
    expect(resp?.status()).toBe(200);
    const cards = page.locator('[data-testid="stat-card"]');
    await expect(cards).toHaveCount(4);
    await expect(cards.last()).toBeVisible();

    // One-shot measurement — sequential boundingBox() calls raced a re-render.
    const heights = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  });

  test("admin/flags page renders toggles", async ({ page }) => {
    const resp = await page.goto("/admin/flags");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("switch").first()).toBeVisible();
  });

  test("admin/users page renders user list with checkboxes", async ({ page }) => {
    const resp = await page.goto("/admin/users");
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });
});
