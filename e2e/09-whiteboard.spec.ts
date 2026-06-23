import { test, expect } from "./fixtures/console-errors";

async function gotoWhiteboard(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.locator('a[href^="/w/"]').first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  await page.locator('a[href*="/b/"]').first().click();
  await page.waitForURL(/\/b\/[^/]+/);
  const tab = page.getByRole("link", { name: /^whiteboard$/i }).first();
  if (!(await tab.isVisible().catch(() => false))) return false;
  await tab.click();
  await page.waitForURL(/\/whiteboard/, { timeout: 10_000 });
  return true;
}

test.describe("whiteboard (F12-K91 regression)", () => {
  test("opens without console errors and shows canvas", async ({ page }) => {
    const ok = await gotoWhiteboard(page);
    if (!ok) test.skip(true, "whiteboard view not available");
    // Whiteboard uses React Flow or a <canvas>.
    const surface = page.locator("canvas, .react-flow, [data-testid='whiteboard-canvas']").first();
    await expect(surface).toBeVisible({ timeout: 10_000 });
  });

  test("color swatches toggle active state", async ({ page }) => {
    const ok = await gotoWhiteboard(page);
    if (!ok) test.skip(true, "whiteboard view not available");
    const swatch = page.locator('[data-color], button[aria-label*="kolor"], button[aria-label*="color"]').first();
    if (!(await swatch.isVisible().catch(() => false))) {
      test.skip(true, "no color picker found");
    }
    await swatch.click();
    // Active state could be aria-pressed=true or data-active=true.
    const pressed = await swatch.getAttribute("aria-pressed");
    const active = await swatch.getAttribute("data-active");
    expect(pressed === "true" || active === "true").toBeTruthy();
  });
});
