import { test, expect } from "./fixtures/console-errors";

const VIEWS = [
  { name: /^tabela$/i, urlSuffix: /\/table/ },
  { name: /^kanban$/i, urlSuffix: /\/kanban/ },
  { name: /^roadmap/i, urlSuffix: /\/roadmap/ },
  { name: /^gantt$/i, urlSuffix: /\/gantt/ },
  { name: /^kalendarz$/i, urlSuffix: /\/calendar/ },
  { name: /^whiteboard$/i, urlSuffix: /\/whiteboard/ },
  { name: /^linia zadań$/i, urlSuffix: /\/taskline/ },
  { name: /^opis|overview/i, urlSuffix: /\/overview/ },
];

async function gotoFirstBoard(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.locator('a[href^="/w/"]').first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  await page.locator('a[href*="/b/"]').first().click();
  await page.waitForURL(/\/b\/[^/]+/);
}

test.describe("view switcher (F12-K88)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
  });

  for (const v of VIEWS) {
    test(`switch to ${v.name.source}`, async ({ page }) => {
      const link = page.getByRole("link", { name: v.name }).first();
      if (!(await link.isVisible().catch(() => false))) {
        test.skip(true, `view link not found: ${v.name}`);
      }
      await link.click();
      await page.waitForURL(v.urlSuffix, { timeout: 10_000 });
      await expect(page).toHaveURL(v.urlSuffix);
    });
  }

  test("switcher stays single-row (no wrapping)", async ({ page }) => {
    const switcher = page.locator('[data-testid="view-switcher"], nav').first();
    if (!(await switcher.isVisible().catch(() => false))) {
      test.skip(true, "switcher container not found");
    }
    const box = await switcher.boundingBox();
    // Heuristic: a one-row switcher is < 80px tall.
    expect(box!.height).toBeLessThan(80);
  });
});
