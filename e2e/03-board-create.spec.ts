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

  // Usuwanie tablicy zniknęło raz przy przepisywaniu przestrzeni: akcja została
  // w backendzie, ale straciła jedyne wywołanie i nikt tego nie zauważył.
  test("usuwanie tablicy: pierwszy klik pyta, drugi kasuje", async ({ page }) => {
    await page.goto("/workspaces");
    await page.locator('[data-ui="main"] a[href^="/w/"]').first().click();
    await page.waitForURL(/\/w\/[^/]+$/);

    await page.getByRole("button", { name: "Nowa tablica" }).first().click();
    const dialog = page.getByRole("dialog").filter({ has: page.locator('input[name="name"]') });
    const boardName = `e2e-board-del-${Date.now()}`;
    await dialog.locator('input[name="name"]').fill(boardName);
    await dialog.getByRole("button", { name: "Utwórz tablicę" }).click();
    await page.waitForURL(/\/w\/[^/]+\/b\/[^/]+\/table/, { timeout: 15_000 });
    const boardUrl = page.url();

    await page.getByRole("button", { name: "Więcej opcji tablicy" }).click();
    await page.getByRole("menuitem", { name: "Usuń tablicę" }).click();
    // Jeden klik nie może skasować tablicy z zadaniami.
    await expect(page.getByRole("menuitem", { name: /Na pewno usunąć/ })).toBeVisible();
    expect(page.url()).toBe(boardUrl);

    await page.getByRole("menuitem", { name: /Na pewno usunąć/ }).click();
    await page.waitForURL(/\/w\/[^/]+$/, { timeout: 15_000 });
    await expect(page.locator('[data-ui="main"]')).not.toContainText(boardName);
  });
});
