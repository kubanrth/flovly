import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, taskDrawer } from "./helpers";

// Regresja 2026-09-08: po zamknięciu panelu klik w TO SAMO zadanie nic nie
// otwierał (slot @modal trzymał zamkniętą instancję; inne zadanie działało).
test("panel zadania otwiera się ponownie dla tego samego zadania", async ({ page }) => {
  await gotoFirstBoard(page);
  const row = page.locator('[data-ui="list-row"] a[href*="/t/"]').first();
  const panel = taskDrawer(page);
  for (let i = 0; i < 2; i++) {
    await row.click();
    await expect(panel.locator('[data-ui="task-detail"]')).toBeVisible({ timeout: 15_000 });
    await panel.locator('[data-ui="task-actions"]').getByRole("button", { name: "Zamknij" }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/table/);
  }
});
