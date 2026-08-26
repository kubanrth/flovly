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
    await column.getByRole("button", { name: "Nowe zadanie" }).click();
    const title = `kanban-${Date.now()}`;
    await column.getByPlaceholder("Tytuł zadania…").fill(title);
    await column.getByPlaceholder("Tytuł zadania…").press("Enter");
    await expect(column.getByText(title)).toBeVisible({ timeout: 10_000 });
  });
});
