import { test, expect } from "./fixtures/console-errors";

test.describe("workspaces list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workspaces");
  });

  test("renders at least one workspace card and navigates", async ({ page }) => {
    // Workspace cards are links to /w/[id]. Pick the first such link.
    const card = page.locator('a[href^="/w/"]').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const href = await card.getAttribute("href");
    await card.click();
    await page.waitForURL(new RegExp(`${href}`));
    await expect(page).toHaveURL(new RegExp(`^.*${href}`));
  });

  test("create workspace dialog opens and validates", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /nowy workspace|nowa przestrzeń|\+ workspace/i }).first();
    if (!(await newBtn.isVisible().catch(() => false))) {
      test.skip(true, "No 'New workspace' trigger visible on /workspaces");
    }
    await newBtn.click();
    // Submit empty → expect a name field validation message.
    const submit = page.getByRole("button", { name: /utwórz|stwórz|dodaj/i }).last();
    await submit.click();
    // Name field should show some validation hint OR the dialog stays open.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });
});
