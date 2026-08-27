import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openView, VIEW_URL, type ViewName } from "./helpers";

// Views enabled on the seed workspace. Gantt/Calendar/Taskline are not
// enabled there (Whiteboard is added by spec 09), so they are not exercised.
const VIEWS: ViewName[] = ["Lista", "Tablica", "Roadmapa", "Opis"];

test.describe("view switcher (F12-K88)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
  });

  for (const name of VIEWS) {
    test(`switch to ${name}`, async ({ page }) => {
      await openView(page, name);
      await expect(page).toHaveURL(VIEW_URL[name]);
      await expect(page.locator('[data-ui="board-tabs"]').getByRole("link", { name, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  test("switcher stays single-row (no wrapping)", async ({ page }) => {
    const switcher = page.locator('[data-ui="board-tabs"]');
    await expect(switcher).toBeVisible();
    const box = (await switcher.boundingBox())!;
    // Heuristic: a one-row switcher is < 80px tall.
    expect(box.height).toBeLessThan(80);
  });
});
