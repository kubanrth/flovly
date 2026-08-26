import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, taskDrawer } from "./helpers";

test.describe("task creation", () => {
  test("create task — dialog opens, closes on submit, task appears and its drawer opens", async ({ page }) => {
    await gotoFirstBoard(page);

    await page.locator('[data-ui="board-header"]').getByRole("button", { name: "Nowe zadanie" }).click();
    const dialog = page.locator('[data-ui="create-task-dialog"]');
    await expect(dialog).toBeVisible();

    // AK55: 480px dialog, fields in mockup order, title autofocused, footer hint.
    // Poll: the popup scales in from .98 (150ms), so a one-shot boundingBox can land mid-animation.
    await expect.poll(async () => Math.abs((await dialog.boundingBox())!.width - 480)).toBeLessThanOrEqual(2);
    await expect(dialog.locator("label")).toHaveText([
      "Tytuł", "Tablica", "Status", "Priorytet", "Termin", "Przypisani", /^Dodaj do widoku/,
    ]);
    await expect(dialog.locator('input[name="title"]')).toBeFocused();
    await expect(dialog.getByText("Utwórz i dodaj kolejne")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeVisible();

    const title = `e2e-task-${Date.now()}`;
    await dialog.locator('input[name="title"]').fill(title);

    // F12-K99 regression (modal hung after submit). The action response carries
    // the revalidated table RSC payload; measured 3.5–4s on `next dev`, so a
    // tighter threshold only makes sense against `next start`.
    await dialog.getByRole("button", { name: "Utwórz zadanie" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // On success the app pushes /w/<ws>/t/<id> → drawer opens with the new task.
    const drawer = taskDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Tytuł zadania")).toHaveValue(title);

    // Close the drawer → the new row is in the table.
    await drawer.getByRole("button", { name: "Zamknij" }).first().click();
    await expect(drawer).toBeHidden();
    await expect(page.locator("table tbody").getByText(title).first()).toBeVisible();
  });

  test("⇧Enter creates and keeps the dialog open with a cleared title", async ({ page }) => {
    await gotoFirstBoard(page);
    await page.locator('[data-ui="board-header"]').getByRole("button", { name: "Nowe zadanie" }).click();
    const dialog = page.locator('[data-ui="create-task-dialog"]');
    const input = dialog.locator('input[name="title"]');

    const title = `e2e-shift-${Date.now()}`;
    await input.fill(title);
    await input.press("Shift+Enter");

    await expect(input).toHaveValue("", { timeout: 10_000 });
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();

    await dialog.getByRole("button", { name: "Anuluj" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("table tbody").getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });
});
