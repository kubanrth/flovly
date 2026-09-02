import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openView } from "./helpers";

test.describe("kanban", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
    await openView(page, "Tablica");
  });

  test("status columns are visible", async ({ page }) => {
    // Columns are role=group "Kolumna <name>, N zadań"; seed board has the default "Do zrobienia".
    await expect(page.getByRole("group", { name: /^Kolumna Do zrobienia/ })).toBeVisible();
    expect(await page.locator('[role="group"][aria-label^="Kolumna"]').count()).toBeGreaterThanOrEqual(4);
  });

  test("inline 'new task' in a column adds card", async ({ page }) => {
    const column = page.locator('[role="group"][aria-label^="Kolumna"]').first();
    await column.getByRole("button", { name: "Utwórz zadanie" }).click();
    const title = `kanban-${Date.now()}`;
    await column.getByPlaceholder("Tytuł zadania…").fill(title);
    await column.getByPlaceholder("Tytuł zadania…").press("Enter");
    await expect(column.getByText(title)).toBeVisible({ timeout: 10_000 });
  });
  // Kolejnosc kolumn dalo sie zmienic tylko w pikcerze statusu w Tabeli — na
  // samej Tablicy nie bylo gestu, choc akcja i uprawnienie juz istnialy.
  //
  // Tu sprawdzamy sam uchwyt i to, ze przeciagniecie faktycznie rusza kolumne
  // (stopka mowi, co jest niesione). Skutku upuszczenia nie asertujemy: zalezy
  // od tego, gdzie w danym momencie animacji jest sasiad, i pod obciazeniem
  // calego zestawu potrafi wyladowac o jedno miejsce obok. Sama arytmetyka
  // przestawienia ma wlasny sprawdzian: components/kanban/column-order.check.ts.
  test("naglowek kolumny jest uchwytem do zmiany kolejnosci", async ({ page }) => {
    const kolumny = page.locator('[data-ui="kanban-column"]');
    await expect(kolumny.first()).toBeVisible();
    const ile = await kolumny.count();
    expect(ile).toBeGreaterThan(2);

    // Kazda kolumna ze statusem ma uchwyt oznaczony jako sortowalny.
    const uchwyty = page.locator('[data-ui="kanban-column-handle"]');
    expect(await uchwyty.count()).toBe(ile);
    await expect(uchwyty.first()).toHaveAttribute("aria-roledescription", "sortable");
    await expect(uchwyty.first()).toHaveCSS("cursor", "grab");

    // Przeciagniecie naglowka podnosi kolumne, a nie karte.
    const a = (await uchwyty.first().boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y + a.height / 2, { steps: 8 });
    await expect(page.locator('[data-ui="kanban-footer"]')).toContainText("przeciąganie kolumny");
    // Upuszczamy tam, skad wzielismy — kolumna na sama siebie to brak zmiany,
    // wiec test nie zostawia po sobie przestawionej tablicy.
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-ui="kanban-column"]').first()).toBeVisible();
  });
});
