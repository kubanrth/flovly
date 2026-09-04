import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openView, waitForTable , resetFixtures } from "./helpers";

test.describe("table view", () => {
  test.beforeAll(() => resetFixtures());
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
  });

  test("ID column shows numeric ids, never cuids (F12-K87/K89)", async ({ page }) => {
    // K87 removed the 4-char cuid "ID" column; K89 brought it back as a numeric
    // displayId. Guard the intent: every ID cell is a plain integer.
    const headers = page.locator("table thead th");
    await expect(headers.first()).toBeVisible();
    const idx = (await headers.allInnerTexts()).findIndex((t) => t.replace(/\s/g, "").toUpperCase() === "#ID");
    expect(idx).toBeGreaterThan(-1);

    const taskRows = page.locator('table tbody tr[data-ui="list-row"]');
    await expect(taskRows.first()).toBeVisible();
    const cells = await taskRows.locator(`td:nth-child(${idx + 1})`).allInnerTexts();
    expect(cells.length).toBeGreaterThan(0);
    for (const text of cells) expect(text.trim()).toMatch(/^\d+$/);
  });

  test("B1 metrics: real table, sticky 32px header, 36px rows, frozen title", async ({ page }) => {
    const table = page.locator('[data-ui="list-table"]');
    await expect(table).toHaveJSProperty("tagName", "TABLE");
    const thead = table.locator("thead");
    expect(await thead.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    expect((await thead.boundingBox())!.height).toBeCloseTo(32, 0);
    const row = page.locator('[data-ui="list-row"]').first();
    expect((await row.boundingBox())!.height).toBeCloseTo(36, 0);
    await row.hover();
    expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(243, 241, 238)");

    const title = table.locator("thead th").filter({ hasText: /^Tytuł$/ });
    const before = (await title.boundingBox())!.x;
    await table.locator("..").evaluate((el) => (el.scrollLeft = 600));
    expect((await title.boundingBox())!.x).toBeCloseTo(before, 0);
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

  test("bulk select shows selected count + bulk bar", async ({ page }) => {
    const boxes = page.locator('table tbody [role="checkbox"][aria-label^="Zaznacz wiersz"]');
    await expect(boxes.nth(1)).toBeVisible();
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(page.locator("body")).toContainText(/2\s*zaznaczone/i);
    const bar = page.locator('[data-ui="bulk-bar"]');
    await expect(bar).toBeVisible();
    for (const label of ["Status", "Priorytet", "Przypisz", "Usuń"]) await expect(bar.getByRole("button", { name: label })).toBeVisible();
    const row = page.locator('[data-ui="list-row"]').first();
    expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 244, 238)");
  });

  test("filter chip via + Filtr, persists across reload, Wyczyść clears", async ({ page }) => {
    const total = await page.locator('[data-ui="list-row"]').count();
    await page.locator('[data-ui="board-toolbar"]').getByRole("button", { name: "Filtr" }).click();
    const builder = page.locator('[data-ui="filter-builder"]');
    await expect(builder).toBeVisible();
    await builder.getByLabel("Kolumna").selectOption({ label: "Status" });
    const value = builder.getByLabel("Wartość");
    const statusName = (await value.locator("option").nth(1).innerText()).trim();
    const statusId = (await value.locator("option").nth(1).getAttribute("value"))!;
    // Persist is a fire-and-forget server action — reloading mid-flight aborts the
    // fetch (console error) and races the write; wait for the payload to land.
    const saved = page.waitForResponse(
      (r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes(statusId),
    );
    await value.selectOption({ label: statusName });
    await page.keyboard.press("Escape");
    await saved;

    const chip = page.locator('[data-ui="filter-chip"]');
    await expect(chip).toHaveText(new RegExp(`Status: ${statusName}`));
    expect(await chip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 232, 219)");
    await expect.poll(() => page.locator('[data-ui="list-row"]').count()).toBeLessThan(total);

    await page.reload();
    await waitForTable(page);
    await expect(page.locator('[data-ui="filter-chip"]')).toHaveText(new RegExp(`Status: ${statusName}`));
    await page.locator('[data-ui="board-toolbar"]').getByRole("button", { name: "Wyczyść" }).click();
    await expect(page.locator('[data-ui="filter-chip"]')).toHaveCount(0);
    await expect.poll(() => page.locator('[data-ui="list-row"]').count()).toBe(total);
  });

  test("group by status shows group headers with chip + count, footer counts tasks", async ({ page }) => {
    await page.locator('[data-ui="board-toolbar"]').getByRole("button", { name: /^Grupuj/ }).click();
    await page.getByRole("menuitemradio", { name: "Status" }).click();
    const headers = page.locator('[data-ui="group-header"]');
    await expect(headers.first()).toBeVisible();
    expect((await headers.first().boundingBox())!.height).toBeCloseTo(36, 0);
    await expect(headers.first()).toContainText(/zada/);
    await headers.first().getByRole("button", { name: "Zwiń grupę" }).click();
    await expect(headers.first()).toContainText("zwinięte");
    await expect(page.locator('[data-ui="list-footer"]')).toContainText(/\d+ zada/);
    // Reset for the other specs.
    await page.locator('[data-ui="board-toolbar"]').getByRole("button", { name: /^Grupuj/ }).click();
    await page.getByRole("menuitemradio", { name: "Brak" }).click();
    await expect(headers).toHaveCount(0);
  });
  // Sekcje: wlasne nagłówki na liscie, ten sam uklad co grupowanie po
  // milestonach, tylko z nazwami uzytkownika.
  test("Sekcje: przycisk zaklada pole, dodaje nazwy i dzieli liste", async ({ page }) => {
    const przycisk = page.getByRole("button", { name: /^Sekcje/ }).first();
    await expect(przycisk).toBeVisible();
    await przycisk.click();
    const panel = page.locator('[data-slot="popover-content"]').last();
    await expect(panel).toBeVisible();

    // Pierwsze wejscie: pole jeszcze nie istnieje.
    const utworz = panel.getByRole("button", { name: "Utwórz sekcje" });
    if (await utworz.count()) {
      await utworz.click();
      // Kolumna wraca z serwera — panel przelacza sie w edytor nazw.
      await expect(panel.getByPlaceholder("Dodaj opcję…")).toBeVisible({ timeout: 20_000 });
    }

    const nazwa = `Sekcja-${Date.now()}`;
    await panel.getByPlaceholder("Dodaj opcję…").fill(nazwa);
    await page.keyboard.press("Enter");
    await expect(panel.getByLabel("Nazwa opcji").filter({ hasText: "" })).not.toHaveCount(0);
    expect(await panel.getByLabel("Nazwa opcji").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toContain(nazwa);

    // Wlacz podzial, jesli jeszcze nie dziala.
    const wlacz = panel.getByRole("button", { name: "Pokaż listę w sekcjach" });
    if (await wlacz.count()) await wlacz.click();
    await page.keyboard.press("Escape");

    // Lista jest pogrupowana, a zadania bez sekcji sa na koncu.
    const naglowki = page.locator('[data-ui="group-header"]');
    await expect(naglowki.first()).toBeVisible({ timeout: 20_000 });
    const etykiety = (await naglowki.allInnerTexts()).map((t) => t.split("\n")[0]!.trim());
    expect(etykiety.at(-1)).toBe("— brak —");
  });
});
