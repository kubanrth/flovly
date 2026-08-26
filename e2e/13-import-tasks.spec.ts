import path from "node:path";
import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard , resetFixtures } from "./helpers";

// AK56 — requires the `import_csv_xls` system flag (on by default; /admin/flags).
test.describe("import tasks (CSV)", () => {
  test.beforeAll(() => resetFixtures());
  test("Plik → Podgląd → Mapowanie kolumn → 3 new rows", async ({ page }) => {
    await gotoFirstBoard(page);
    const rowsBefore = await page.locator("table tbody tr").count();

    await page.locator('[data-ui="board-header"]').getByRole("button", { name: "Import CSV/XLS" }).click();
    const dialog = page.locator('[data-ui="import-dialog"]');
    await expect(dialog).toBeVisible();
    // Poll: the popup scales in from .98 (150ms), so a one-shot boundingBox can land mid-animation.
    await expect.poll(async () => Math.abs((await dialog.boundingBox())!.width - 560)).toBeLessThanOrEqual(2);
    await expect(dialog.getByText("Mapowanie kolumn")).toBeVisible();

    // Step 1 → 2: hidden file input backs the drop zone.
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/import-3.csv"));
    await expect(dialog.getByText("import-3.csv")).toBeVisible();
    await expect(dialog.getByText("3 wiersze")).toBeVisible();
    await expect(dialog.getByText("Import e2e — cennik dostaw")).toBeVisible();

    // Step 2 → 3: auto-mapping Nazwa→Tytuł, Stan→Status, Deadline→Koniec.
    await dialog.getByRole("button", { name: "Dalej" }).click();
    await expect(dialog.getByRole("combobox", { name: "Mapowanie kolumny Nazwa" })).toHaveText("Tytuł");
    await expect(dialog.getByRole("combobox", { name: "Mapowanie kolumny Stan" })).toContainText("Status");
    await expect(dialog.getByRole("combobox", { name: "Mapowanie kolumny Deadline" })).toHaveText("Koniec");
    await expect(dialog.getByText("3 zadania trafią do tablicy")).toBeVisible();

    await dialog.getByRole("button", { name: "Importuj 3 zadania" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await expect(page.locator("table tbody").getByText("Import e2e — regulamin przedsprzedaży").first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.locator("table tbody tr").count(), { timeout: 15_000 }).toBe(rowsBefore + 3);
  });
});
