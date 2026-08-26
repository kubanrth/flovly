import { test, expect } from "./fixtures/console-errors";

// The only "new board" trigger is the CTA on the workspace overview page.
test.describe("board create", () => {
  test("create board dialog opens and creates with defaults", async ({ page }) => {
    await page.goto("/workspaces");
    await page.locator('[data-ui="main"] a[href^="/w/"]').first().click();
    await page.waitForURL(/\/w\/[^/]+$/);

    await page.getByRole("button", { name: "Nowa tablica" }).first().click();
    const dialog = page.getByRole("dialog").filter({ has: page.locator('input[name="name"]') });
    await expect(dialog).toBeVisible();

    const boardName = `e2e-board-${Date.now()}`;
    await dialog.locator('input[name="name"]').fill(boardName);
    await dialog.getByRole("button", { name: "Utwórz tablicę" }).click();

    // Should navigate to the new board's table view with default status columns.
    await page.waitForURL(/\/w\/[^/]+\/b\/[^/]+\/table/, { timeout: 15_000 });
    await expect(page.locator('[data-ui="board-name"]')).toContainText(boardName);
    await expect(page.locator("body")).toContainText(/Do zrobienia|Backlog|W trakcie|Status/i);
  });
});
