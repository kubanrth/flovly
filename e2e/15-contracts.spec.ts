import { test, expect } from "./fixtures/console-errors";

// F13 „Umowy": utworz z wlasnymi polami -> widoczne na karcie -> edytuj -> usun.
test.describe("umowy", () => {
  test("wlasne pola umowy sa widoczne na liscie, edycja i usuniecie", async ({ page }) => {
    await page.goto("/workspaces");
    const ws = await page.locator('[data-ui="sidebar"] a[href^="/w/"]').first().getAttribute("href");
    await page.goto(`${ws!.split("/").slice(0, 3).join("/")}/contracts`);
    await expect(page.getByRole("heading", { name: "Umowy" })).toBeVisible();

    const tytul = `e2e-umowa-${Date.now()}`;
    await page.getByRole("button", { name: "Nowa umowa" }).first().click();
    const dialog = page.locator('[data-ui="contract-dialog"]');
    await dialog.getByLabel("Tytuł umowy").fill(tytul);
    await dialog.getByLabel("Nazwa pola 1").fill("Czas trwania umowy");
    await dialog.getByLabel("Wartość pola 1").fill("2 lata");
    await dialog.getByRole("button", { name: "Dodaj pole" }).click();
    await dialog.getByLabel("Nazwa pola 2").fill("Stały rabat hurtowy");
    await dialog.getByLabel("Wartość pola 2").fill("6%");
    await dialog.getByRole("button", { name: "Utwórz umowę" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // Pola sa na karcie od razu, bez wchodzenia w szczegoly.
    const karta = page.locator('[data-ui="contract-card"]').filter({ hasText: tytul });
    await expect(karta).toBeVisible({ timeout: 20_000 });
    await expect(karta).toContainText("Szczegóły umowy");
    await expect(karta).toContainText("Czas trwania umowy");
    await expect(karta).toContainText("2 lata");
    await expect(karta).toContainText("Stały rabat hurtowy");
    await expect(karta).toContainText("6%");

    // Edycja zachowuje pola i zmienia wartosc.
    await karta.getByRole("button", { name: `Edytuj umowę ${tytul}` }).click();
    await expect(dialog.getByLabel("Wartość pola 1")).toHaveValue("2 lata");
    await dialog.getByLabel("Wartość pola 1").fill("3 lata");
    await dialog.getByRole("button", { name: "Zapisz zmiany" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(karta).toContainText("3 lata", { timeout: 20_000 });

    // Usuniecie — karta znika.
    page.once("dialog", (d) => d.accept());
    await karta.getByRole("button", { name: `Usuń umowę ${tytul}` }).click();
    await expect(page.locator('[data-ui="contract-card"]').filter({ hasText: tytul })).toHaveCount(0, { timeout: 20_000 });
  });
});
