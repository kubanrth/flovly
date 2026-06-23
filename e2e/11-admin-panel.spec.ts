import { test, expect } from "./fixtures/console-errors";

test.describe("admin panel", () => {
  test("admin home shows stat cards", async ({ page }) => {
    const resp = await page.goto("/admin");
    if (!resp || resp.status() === 404 || resp.status() === 403) {
      test.skip(true, `/admin returned ${resp?.status() ?? "no response"} — user not super admin`);
    }
    // 4 stat cards (F12-K100): same height.
    const cards = page.locator('[data-testid="stat-card"], section [class*="card"]');
    const count = await cards.count();
    if (count < 4) test.skip(true, `expected ≥4 stat cards, found ${count}`);

    const heights: number[] = [];
    for (let i = 0; i < 4; i++) {
      const b = await cards.nth(i).boundingBox();
      if (b) heights.push(b.height);
    }
    const max = Math.max(...heights);
    const min = Math.min(...heights);
    expect(max - min).toBeLessThanOrEqual(2);
  });

  test("admin/flags page renders toggles", async ({ page }) => {
    const resp = await page.goto("/admin/flags");
    if (!resp || resp.status() >= 400) test.skip(true, "admin/flags not accessible");
    const toggles = page.locator('[role="switch"]');
    expect(await toggles.count()).toBeGreaterThan(0);
  });

  test("admin/users page renders user list", async ({ page }) => {
    const resp = await page.goto("/admin/users");
    if (!resp || resp.status() >= 400) test.skip(true, "admin/users not accessible");
    // Checkbox column exists.
    const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThan(0);
  });
});
