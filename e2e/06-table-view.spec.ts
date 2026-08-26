import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openView, waitForTable } from "./helpers";

test.describe("table view", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
  });

  test("ID column shows numeric #ids, never cuids (F12-K87/K89)", async ({ page }) => {
    // K87 removed the 4-char cuid "ID" column; K89 brought "ID" back as a
    // numeric displayId (#123). Guard the intent: every ID cell is "#<n>".
    const headers = page.locator("table thead th");
    await expect(headers.first()).toBeVisible();
    const idx = (await headers.allInnerTexts()).findIndex((t) => t.trim().toUpperCase() === "ID");
    expect(idx).toBeGreaterThan(-1);

    const taskRows = page.locator("table tbody tr").filter({ has: page.locator('a[href*="/t/"]') });
    await expect(taskRows.first()).toBeVisible();
    const cells = await taskRows.locator(`td:nth-child(${idx + 1})`).allInnerTexts();
    expect(cells.length).toBeGreaterThan(0);
    for (const text of cells) expect(text.trim()).toMatch(/^#\d+$/);
  });

  test("column resize persists across view switch (F12-K90)", async ({ page }) => {
    const header = page.locator("table thead th").nth(1);
    await expect(header).toBeVisible();
    const before = (await header.boundingBox())!.width;

    const handle = header.getByRole("separator", { name: "Zmień szerokość kolumny" });
    const hBox = (await handle.boundingBox())!;
    // Widths persist via a debounced (800ms) server action carrying {"widths":…};
    // switching views before it lands would test the race, not persistence.
    const saved = page.waitForResponse(
      (r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes('"widths"'),
    );
    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(hBox.x + 50, hBox.y + hBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const after = (await header.boundingBox())!.width;
    expect(after).toBeGreaterThan(before + 10);
    await saved;

    await openView(page, "Tablica");
    await openView(page, "Lista");
    await waitForTable(page);

    const headerAgain = page.locator("table thead th").nth(1);
    await expect(headerAgain).toBeVisible();
    const persisted = (await headerAgain.boundingBox())!.width;
    expect(Math.abs(persisted - after)).toBeLessThan(5);
  });

  test("bulk select shows selected count", async ({ page }) => {
    const boxes = page.locator('table tbody [role="checkbox"][aria-label^="Zaznacz wiersz"]');
    await expect(boxes.nth(1)).toBeVisible();
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(page.locator("body")).toContainText(/2\s*zaznaczone/i);
  });
});
