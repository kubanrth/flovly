import { test, expect } from "./fixtures/console-errors";

test.describe("workspaces list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workspaces");
  });

  test("renders at least one workspace card and navigates", async ({ page }) => {
    // Cards live in <main>; the sidebar also has /w/ links, so scope to main.
    const card = page.locator('[data-ui="main"] a[href^="/w/"]').first();
    await expect(card).toBeVisible();
    const href = (await card.getAttribute("href"))!;
    await card.click();
    await page.waitForURL((url) => url.pathname === href);
  });

  test("create workspace dialog opens and validates", async ({ page }) => {
    await page.locator('[data-ui="main"]').getByRole("button", { name: /nowa przestrzeń/i }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Nowa przestrzeń robocza" });
    await expect(dialog).toBeVisible();
    // Submit empty → name is required, dialog must stay open and no navigation.
    await dialog.getByRole("button", { name: "Utwórz przestrzeń" }).click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/workspaces/);
  });
});
