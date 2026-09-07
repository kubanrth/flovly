import { test, expect } from "./fixtures/console-errors";

// F13 „Zapotrzebowanie": zglos -> wiersz z projektem, linkiem, kosztem i zglaszajacym -> edytuj -> usun.
test.describe("zapotrzebowanie", () => {
  test("zgloszenie zakupu jest w tablicy z kosztem i zglaszajacym, edycja i usuniecie", async ({ page }) => {
    await page.goto("/workspaces");
    const ws = await page.locator('[data-ui="sidebar"] a[href^="/w/"]').first().getAttribute("href");
    await page.goto(`${ws!.split("/").slice(0, 3).join("/")}/purchases`);
    await expect(page.getByRole("heading", { name: "Zapotrzebowanie" })).toBeVisible();

    const projekt = `e2e-zakup-${Date.now()}`;
    await page.getByRole("button", { name: "Nowe zgłoszenie" }).first().click();
    const dialog = page.locator('[data-ui="purchase-dialog"]');
    await dialog.getByLabel("Projekt").fill(projekt);
    await dialog.getByLabel("Link").fill("allegro.pl/oferta/123");
    await dialog.getByLabel("Koszt").fill("129,99");
    await dialog.getByRole("button", { name: "Zgłoś" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const wiersz = page.locator('[data-ui="purchase-row"]').filter({ hasText: projekt });
    await expect(wiersz).toBeVisible({ timeout: 20_000 });
    await expect(wiersz).toContainText("129,99");
    await expect(wiersz.getByRole("link", { name: /allegro\.pl/ })).toHaveAttribute("href", "https://allegro.pl/oferta/123");
    await expect(wiersz).toContainText("(ja)");

    await wiersz.getByRole("button", { name: `Edytuj zgłoszenie ${projekt}` }).click();
    await expect(dialog.getByLabel("Koszt")).toHaveValue("129,99");
    await dialog.getByLabel("Koszt").fill("99");
    await dialog.getByRole("button", { name: "Zapisz zmiany" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(wiersz).toContainText("99,00", { timeout: 20_000 });

    page.once("dialog", (d) => d.accept());
    await wiersz.getByRole("button", { name: `Usuń zgłoszenie ${projekt}` }).click();
    await expect(page.locator('[data-ui="purchase-row"]').filter({ hasText: projekt })).toHaveCount(0, { timeout: 20_000 });
  });
});
