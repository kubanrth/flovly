import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/console-errors";
import { boardTab, gotoFirstBoard, openView } from "./helpers";

// The seed board has no Whiteboard view — create it once via the `+` tab
// (idempotent: the tab is checked first; later runs just switch to it).
async function openWhiteboard(page: Page) {
  await gotoFirstBoard(page);
  if ((await boardTab(page, "Whiteboard").count()) > 0) {
    await openView(page, "Whiteboard");
    return;
  }
  await page.getByRole("button", { name: "Nowy widok" }).click();
  const dialog = page.locator('[data-ui="new-view-dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /^Whiteboard/ }).click();
  // Empty name + no default view of that type → "Przywróć Whiteboard".
  await dialog.getByRole("button", { name: /^(Utwórz widok|Przywróć Whiteboard)$/ }).click();
  await page.waitForURL(/\/whiteboard/, { timeout: 15_000 });
}

test.describe("whiteboard (F12-K91 regression)", () => {
  test.beforeEach(async ({ page }) => {
    await openWhiteboard(page);
  });

  test("opens without console errors and shows canvas", async ({ page }) => {
    // Canvas editor is lazy-loaded (CanvasEditorLazy) → generous timeout.
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 15_000 });
  });

  test("pen color swatches toggle active state", async ({ page }) => {
    await page.getByRole("button", { name: "Pisak (P)" }).click({ timeout: 15_000 });
    const swatches = page.locator('button[aria-label^="Kolor pisaka"]');
    await expect(swatches.first()).toHaveCSS("outline-style", "solid");
    await swatches.nth(1).click();
    // Active state = 2px outline on the picked swatch, cleared on the previous one.
    await expect(swatches.nth(1)).toHaveCSS("outline-style", "solid");
    await expect(swatches.first()).toHaveCSS("outline-style", "none");
  });
});
