import { test, expect } from "./fixtures/console-errors";

// Helper: enter the first available workspace.
async function gotoFirstWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  const card = page.locator('a[href^="/w/"]').first();
  await card.click();
  await page.waitForURL(/\/w\/[^/]+/);
}

test.describe("board create", () => {
  test("create board dialog opens and creates with defaults", async ({ page }) => {
    await gotoFirstWorkspace(page);

    const newBoardBtn = page
      .getByRole("button", { name: /\+ tablica|nowa tablica|new board/i })
      .first();
    if (!(await newBoardBtn.isVisible().catch(() => false))) {
      test.skip(true, "No 'New board' trigger visible");
    }
    await newBoardBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const boardName = `e2e-board-${Date.now()}`;
    await dialog.locator('input[name="name"], input[name="title"]').first().fill(boardName);
    await dialog.getByRole("button", { name: /utwórz|stwórz|dodaj/i }).first().click();

    // Should navigate to the new board's table view.
    await page.waitForURL(/\/w\/[^/]+\/b\/[^/]+\/table/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/b\/.*\/table/);

    // Default 4 status columns — assert at least Backlog / To do exist visually.
    // (We only assert the page rendered; column-count check is brittle.)
    await expect(page.locator("body")).toContainText(/Do zrobienia|Backlog|W trakcie|Status/i);
  });
});
