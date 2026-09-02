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
  // „Nowy milestone" siedzial pod ⋯ i nikt go tam nie szukal — to glowna akcja
  // roadmapy, wiec stoi w pasku.
  test("Nowy milestone jest w pasku roadmapy, nie pod trzema kropkami", async ({ page }) => {
    await openView(page, "Roadmapa");
    const przycisk = page.locator('[data-ui="roadmap-new-milestone"]');
    await expect(przycisk).toBeVisible();
    await expect(przycisk).toContainText("Nowy milestone");

    // Pod ⋯ juz go nie ma — zeby nie bylo dwoch wejsc w to samo.
    const kropki = page.getByRole("button", { name: "Opcje roadmapy" });
    await kropki.click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Nowy milestone/ })).toHaveCount(0);
    await kropki.click(); // zamknij — otwarte menu przechwytuje klikniecia
    await expect(page.getByRole("menuitem")).toHaveCount(0);

    await przycisk.click();
    await expect(page.getByRole("dialog").getByText("Nowy milestone")).toBeVisible();
  });
});
