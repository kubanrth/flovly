import { test, expect } from "./fixtures/console-errors";

// Paleta ⌘K po przeprojektowaniu (liquid glass, 2026-09-13): otwiera się z paska,
// filtruje wyniki, Enter przenosi do tablicy, a tafla jest naprawdę szklana.
test.describe("paleta wyszukiwania (⌘K)", () => {
  test("otwiera się z paska, filtruje i otwiera tablicę", async ({ page }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: /Szukaj zadań, tablic, osób/ }).click();
    const paleta = page.locator('[data-ui="command-palette"]');
    await expect(paleta).toBeVisible();
    await expect(paleta.getByPlaceholder("Szukaj przestrzeni, tablicy, zadania…")).toBeFocused();

    // Sekcje z danych użytkownika: tablice zawsze są (seed), akcje zawsze na końcu.
    await expect(paleta.getByText("Tablice", { exact: true })).toBeVisible();
    await expect(paleta.getByText("Akcje", { exact: true })).toBeVisible();

    // Szkło: rozmyte tło zamiast płaskiej białej karty.
    const filtr = await paleta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "";
    });
    expect(filtr).toContain("blur");

    await paleta.getByPlaceholder("Szukaj przestrzeni, tablicy, zadania…").fill("Kampania Q4");
    const wynik = paleta.locator("[cmdk-item]").filter({ hasText: "Kampania Q4" }).first();
    await expect(wynik).toBeVisible();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/b\/[^/]+\/table/);
    await expect(paleta).toBeHidden();
  });

  test("brak wyników mówi, czego szukano, a Esc zamyka", async ({ page }) => {
    await page.goto("/workspaces");
    await page.keyboard.press("Meta+k");
    const paleta = page.locator('[data-ui="command-palette"]');
    await expect(paleta).toBeVisible();
    await paleta.getByPlaceholder("Szukaj przestrzeni, tablicy, zadania…").fill("xq-nie-ma-takiego");
    await expect(paleta.getByText(/Nic nie pasuje do „xq-nie-ma-takiego”/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(paleta).toBeHidden();
  });
});
