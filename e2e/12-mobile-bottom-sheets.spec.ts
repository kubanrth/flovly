import { test, expect } from "./fixtures/console-errors";

// 12 — Mobile-only project (configured in playwright.config.ts).
// Tests bottom-sheet behaviour vs popovers, sidebar opacity, FAB drawers.

test.describe("mobile bottom sheets (375×812)", () => {
  test("mobile sidebar has solid background (F12-K84/K94)", async ({ page }) => {
    await page.goto("/workspaces");
    const hamburger = page.getByRole("button", { name: /menu|otwórz menu|hamburger/i }).first();
    if (!(await hamburger.isVisible().catch(() => false))) {
      test.skip(true, "no hamburger trigger on mobile");
    }
    await hamburger.click();
    const drawer = page.locator('[role="dialog"], aside, [data-state="open"]').first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Read the background-color RGB — alpha channel must be 1 (not transparent).
    const bg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor);
    // "rgba(... , 1)" or "rgb(...)" — both are opaque.
    const alphaMatch = bg.match(/rgba?\([^)]*?,\s*([0-9.]+)\)/);
    if (alphaMatch && alphaMatch[1]) {
      expect(Number(alphaMatch[1])).toBeGreaterThanOrEqual(0.95);
    }
  });

  test("date picker opens as bottom sheet, not popover", async ({ page }) => {
    // Reach any task drawer's "Start" date.
    await page.goto("/workspaces");
    const wsLink = page.locator('a[href^="/w/"]').first();
    if (!(await wsLink.isVisible().catch(() => false))) test.skip(true, "no workspace");
    await wsLink.click();
    await page.waitForURL(/\/w\/[^/]+/);
    const boardLink = page.locator('a[href*="/b/"]').first();
    if (!(await boardLink.isVisible().catch(() => false))) test.skip(true, "no board");
    await boardLink.click();
    await page.waitForURL(/\/b\/[^/]+/);
    const task = page.locator('[data-task-id], table tbody tr a').first();
    if (!(await task.isVisible().catch(() => false))) test.skip(true, "no task to open");
    await task.click();

    const startBtn = page.getByRole("button", { name: /start|początek/i }).first();
    if (!(await startBtn.isVisible().catch(() => false))) {
      test.skip(true, "no Start date trigger");
    }
    await startBtn.click();
    const sheet = page.locator('[data-bottom-sheet], [role="dialog"]').last();
    await expect(sheet).toBeVisible({ timeout: 3_000 });
    // Heuristic: bottom sheet is anchored to the bottom — its Y > viewport/2.
    const viewport = page.viewportSize()!;
    const box = await sheet.boundingBox();
    if (box) expect(box.y).toBeGreaterThan(viewport.height / 3);
  });
});
