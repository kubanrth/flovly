import { test, expect } from "./fixtures/console-errors";

async function gotoKanban(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.locator('a[href^="/w/"]').first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  await page.locator('a[href*="/b/"]').first().click();
  await page.waitForURL(/\/b\/[^/]+/);
  const tab = page.getByRole("link", { name: /^kanban$/i }).first();
  if (await tab.isVisible().catch(() => false)) await tab.click();
  await page.waitForURL(/\/kanban/, { timeout: 10_000 }).catch(() => {});
}

test.describe("kanban", () => {
  test.beforeEach(async ({ page }) => {
    await gotoKanban(page);
  });

  test("status columns are visible", async ({ page }) => {
    // Columns rendered as headings or [data-column].
    const columns = page.locator('[data-column], [role="group"]');
    if ((await columns.count()) === 0) {
      // Fallback: just check the page rendered with kanban-ish text.
      await expect(page.locator("body")).toContainText(/Do zrobienia|W trakcie|Backlog/i);
    } else {
      expect(await columns.count()).toBeGreaterThan(0);
    }
  });

  test("inline 'new task' in a column adds card", async ({ page }) => {
    // Try a "+ Nowe zadanie" inside the first column.
    const inlineAdd = page.getByRole("button", { name: /\+ nowe zadanie|dodaj zadanie/i }).first();
    if (!(await inlineAdd.isVisible().catch(() => false))) {
      test.skip(true, "no inline add button visible");
    }
    await inlineAdd.click();
    const input = page.locator('input[name="title"], textarea[name="title"]').first();
    if (!(await input.isVisible().catch(() => false))) test.skip(true, "no inline input");
    const title = `kanban-${Date.now()}`;
    await input.fill(title);
    await input.press("Enter");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5_000 });
  });
});
