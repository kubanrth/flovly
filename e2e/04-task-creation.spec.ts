import { test, expect } from "./fixtures/console-errors";

async function gotoFirstBoardTable(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.locator('a[href^="/w/"]').first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  // Board card links to /w/X/b/Y/...
  const boardLink = page.locator('a[href*="/b/"]').first();
  await boardLink.click();
  await page.waitForURL(/\/b\/[^/]+/, { timeout: 10_000 });
  // Navigate to table view if not already there.
  const tableTab = page.getByRole("link", { name: /^tabela$/i }).first();
  if (await tableTab.isVisible().catch(() => false)) await tableTab.click();
  await page.waitForURL(/\/table/, { timeout: 10_000 }).catch(() => {});
}

test.describe("task creation", () => {
  test("create task — dialog opens, submits within 3s, task appears", async ({ page }) => {
    await gotoFirstBoardTable(page);

    const newTaskBtn = page
      .getByRole("button", { name: /\+ nowe zadanie|nowe zadanie/i })
      .first();
    if (!(await newTaskBtn.isVisible().catch(() => false))) {
      test.skip(true, "No 'New task' trigger visible");
    }

    await newTaskBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const title = `e2e-task-${Date.now()}`;
    await dialog.locator('input[name="title"]').fill(title);

    // F12-K99 regression: submit + verify modal closes ≤ 3s
    const submit = dialog.getByRole("button", { name: /utwórz|dodaj|zapisz|stwórz/i }).first();
    const start = Date.now();
    await submit.click();
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);

    // Task title appears in the table.
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5_000 });

    // Click title → drawer opens.
    await page.getByText(title).first().click();
    await expect(page.locator('[role="dialog"], [data-testid="task-drawer"]')).toBeVisible({
      timeout: 5_000,
    });
  });
});
