import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openFirstTask } from "./helpers";

// 12 — Mobile-only project (iPhone 12 / WebKit, see playwright.config.ts).

test.describe("mobile bottom sheets", () => {
  test("mobile sidebar drawer has solid background (F12-K84/K94)", async ({ page }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Przełącz pasek boczny" }).click();
    const drawer = page.locator('[data-ui="mobile-drawer"]');
    await expect(drawer).toBeVisible();

    // "rgb(r, g, b)" is opaque; for "rgba(...)" the alpha must be ~1.
    const bg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor);
    const alpha = bg.match(/^rgba\([^)]*,\s*([0-9.]+)\)$/)?.[1];
    expect(alpha === undefined || Number(alpha) >= 0.95, `background-color was ${bg}`).toBe(true);
  });

  test("date picker opens as a bottom sheet, not a popover", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    await page.getByRole("button", { name: "Data startu" }).click();
    const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[role="grid"]')).toBeVisible();

    // Anchored to the bottom edge and fully inside the viewport. Poll: the
    // sheet slides in (translate-y transition) and toBeVisible passes mid-animation.
    const viewport = page.viewportSize()!;
    const edges = async () => {
      const box = (await sheet.boundingBox())!;
      return { top: box.y, bottom: box.y + box.height };
    };
    await expect.poll(async () => (await edges()).bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect((await edges()).top).toBeGreaterThan(viewport.height / 3);
  });
  // Otwarcie zadania z tablicy: edytor komentarza powstaje zanim `useIsMobile`
  // przełączy się po hydratacji. Zostawał wtedy przy dłuższym, desktopowym
  // placeholderze, który zawijał się na drugą linię i wychodził pod ramkę.
  test("pole komentarza mieści placeholder w jednej linii", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    const composer = page.locator('[data-ui="comment-composer"]');
    await expect(composer).toBeVisible();
    const empty = composer.locator("p.is-editor-empty");
    await expect(empty).toHaveAttribute("data-placeholder", "Napisz komentarz…");

    // Ramka zostaje jednoliniowa, a placeholder nigdy się nie zawija — nawet
    // gdyby tekst był dłuższy niż pole.
    const box = composer.locator("[data-variant] > div").first();
    await expect(box).toHaveCSS("min-height", "44px");
    expect(await box.evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(44);
    const ws = await empty.evaluate((el) => getComputedStyle(el, "::before").whiteSpace);
    expect(ws).toBe("nowrap");
  });
});
