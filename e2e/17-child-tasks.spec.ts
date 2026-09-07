import { test, expect } from "./fixtures/console-errors";
import type { Page } from "@playwright/test";
import { boardTab, gotoFirstBoard, openFirstTask, openView, taskDrawer } from "./helpers";

// Seed nie ma Osi czasu — dodajemy ją raz przez „+" (idempotentnie, jak w 09).
async function openGantt(page: Page) {
  await gotoFirstBoard(page);
  if ((await boardTab(page, "Oś czasu").count()) > 0) {
    await openView(page, "Oś czasu");
    return;
  }
  await page.getByRole("button", { name: "Nowy widok" }).click();
  const dialog = page.locator('[data-ui="new-view-dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /^Oś czasu/ }).click();
  await dialog.getByRole("button", { name: /^(Utwórz widok|Przywróć Oś czasu)$/ }).click();
  await page.waitForURL(/\/gantt/, { timeout: 15_000 });
}

// F13: zadania podrzedne jako osobne zadania (jak w Jirze) — z panelu rodzica
// i pod rodzicem w Osi czasu.
test.describe("zadania podrzedne", () => {
  test("z panelu rodzica powstaje osobne zadanie, widoczne pod nim w Osi czasu", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);
    const panel = taskDrawer(page);
    const rodzicTytul = (await panel.getByLabel("Tytuł zadania").inputValue()).trim();

    const tytul = `e2e-dziecko-${Date.now()}`;
    const sekcja = panel.locator('[data-ui="task-children"]');
    await sekcja.getByRole("button", { name: "Nowe zadanie podrzędne" }).click();
    await sekcja.getByLabel("Tytuł zadania podrzędnego").fill(tytul);
    await sekcja.getByRole("button", { name: "Utwórz" }).click();

    // Dziecko ma wlasny numer i status — to zadanie, nie checklista.
    const wiersz = sekcja.locator("li").filter({ hasText: tytul });
    await expect(wiersz).toBeVisible({ timeout: 20_000 });
    await expect(wiersz.locator("span").first()).toHaveText(/^#\d+$/);
    await expect(wiersz.getByRole("link", { name: tytul })).toBeVisible();

    // W panelu dziecka jest link do rodzica.
    await wiersz.getByRole("link", { name: tytul }).click();
    await expect(page.locator('[data-ui="task-parent-link"]')).toContainText(rodzicTytul.slice(0, 20), { timeout: 20_000 });

    // Os czasu: rodzic ma rozwiniecie, dziecko siedzi pod nim, wciete.
    await openGantt(page);
    const os = page.locator('[data-ui="gantt-view"]');
    await expect(os).toBeVisible({ timeout: 20_000 });
    const rodzicWiersz = os.locator('[data-ui="gantt-task-row"]').filter({ hasText: rodzicTytul.slice(0, 20) }).first();
    await expect(rodzicWiersz).toBeVisible();
    await rodzicWiersz.getByRole("button", { name: /Rozwiń zadania podrzędne/ }).click();
    const dziecko = os.locator('[data-ui="gantt-task-row"][data-depth="1"]').filter({ hasText: tytul });
    await expect(dziecko).toBeVisible();

    // Sprzatanie: skasuj dziecko przez panel.
    await dziecko.getByRole("link", { name: tytul }).click();
    await expect(taskDrawer(page).or(page.locator('[data-ui="task-detail"]')).first()).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-ui="task-detail"] [data-ui="task-actions"]').getByRole("button", { name: "Więcej" }).click();
    await page.getByRole("menuitem", { name: "Usuń" }).click();
    await expect(page.locator('[data-ui="task-detail"]')).toBeHidden({ timeout: 20_000 });
  });
});
