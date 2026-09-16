import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard } from "./helpers";

// Oś czasu: skala „Tygodnie" musi pokazywać tygodnie, nie same miesiące
// (2026-09-16, zgłoszenie klienta). Przełącznik skali stoi w pasku widoku.
test.describe("Oś czasu — skala", () => {
  test("tygodnie mają etykiety pod pasmem miesięcy, a przełącznik jest w pasku", async ({ page }) => {
    await gotoFirstBoard(page);
    await page.goto(page.url().replace(/\/table(\?.*)?$/, "/gantt"));
    await expect(page.locator('[data-ui="gantt-grid"]')).toBeVisible({ timeout: 15_000 });

    const skala = page.locator('[data-ui="gantt-zoom"]');
    await expect(skala).toBeVisible();
    await expect(page.locator('[data-ui="board-toolbar"] [data-ui="gantt-zoom"]')).toBeVisible();
    await skala.getByRole("radio", { name: "Tygodnie" }).click();

    const jednostki = page.locator('[data-ui="gantt-units"] > span');
    expect(await jednostki.count()).toBeGreaterThan(3);
    // „14 wrz" — dzień startu tygodnia; pełny tytuł niesie numer ISO.
    await expect(jednostki.first()).toHaveText(/^\d{1,2} \S{3}/);
    await expect(jednostki.first()).toHaveAttribute("title", /^Tydzień \d{1,2}: /);

    await skala.getByRole("radio", { name: "Miesiące" }).click();
    await expect(jednostki.first()).toHaveText(/^[a-ząćęłńóśźż]+$/);
  });
});
