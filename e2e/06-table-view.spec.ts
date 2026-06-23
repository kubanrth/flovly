import { test, expect } from "./fixtures/console-errors";

async function gotoTableView(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.locator('a[href^="/w/"]').first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  await page.locator('a[href*="/b/"]').first().click();
  await page.waitForURL(/\/b\/[^/]+/);
  const tableTab = page.getByRole("link", { name: /^tabela$/i }).first();
  if (await tableTab.isVisible().catch(() => false)) await tableTab.click();
  await page.waitForURL(/\/table/, { timeout: 10_000 }).catch(() => {});
}

test.describe("table view", () => {
  test.beforeEach(async ({ page }) => {
    await gotoTableView(page);
  });

  test("ID column NOT present (F12-K87 regression)", async ({ page }) => {
    // The header row should NOT contain a plain 'ID' label.
    const idHeader = page.locator('th, [role="columnheader"]').filter({ hasText: /^ID$/ });
    await expect(idHeader).toHaveCount(0);
  });

  test("column resize persists across view switch (F12-K90)", async ({ page }) => {
    const header = page.locator('th, [role="columnheader"]').nth(1);
    if (!(await header.isVisible().catch(() => false))) {
      test.skip(true, "no headers visible — board may be empty");
    }
    const before = (await header.boundingBox())!.width;

    // Find the resize handle (typically aria-label or a small drag handle).
    const handle = header.locator('[role="separator"], [data-resize-handle]').first();
    if (!(await handle.isVisible().catch(() => false))) {
      test.skip(true, "no resize handle found");
    }
    const hBox = (await handle.boundingBox())!;
    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(hBox.x + 50, hBox.y + hBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const after = (await header.boundingBox())!.width;
    expect(after).toBeGreaterThan(before + 10);

    // Switch to Kanban and back.
    await page.getByRole("link", { name: /^kanban$/i }).first().click();
    await page.waitForURL(/\/kanban/, { timeout: 10_000 });
    await page.getByRole("link", { name: /^tabela$/i }).first().click();
    await page.waitForURL(/\/table/, { timeout: 10_000 });

    const headerAgain = page.locator('th, [role="columnheader"]').nth(1);
    const persisted = (await headerAgain.boundingBox())!.width;
    expect(Math.abs(persisted - after)).toBeLessThan(5);
  });

  test("bulk select shows selected count", async ({ page }) => {
    const checkboxes = page.locator('tbody input[type="checkbox"], tbody [role="checkbox"]');
    const count = await checkboxes.count();
    if (count < 2) test.skip(true, "need ≥2 rows for bulk-select test");
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await expect(page.locator("body")).toContainText(/2.*(zaznacz|selected)/i);
  });
});
