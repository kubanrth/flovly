import path from "node:path";
import { test, expect } from "./fixtures/console-errors";

// F13 „Dokumenty": wgraj → nadaj dostęp → pobierz → usuń. Test sprząta po sobie.
test.describe("dokumenty", () => {
  test("wgranie, dostęp, pobranie i usunięcie dokumentu", async ({ page }) => {
    await page.goto("/workspaces");
    const ws = await page.locator('[data-ui="sidebar"] a[href^="/w/"]').first().getAttribute("href");
    await page.goto(`${ws!.split("/").slice(0, 3).join("/")}/documents`);
    await expect(page.getByRole("heading", { name: "Dokumenty" })).toBeVisible();

    // Wgraj z wybranym dostępem dla pierwszej osoby z listy.
    await page.getByLabel("Dostęp dla nowych plików").click();
    const opcja = page.getByRole("option").first();
    const osoba = (await opcja.innerText()).trim();
    await opcja.click();
    await page.keyboard.press("Escape");
    await page.getByLabel("Dodaj dokument").setInputFiles(path.resolve("e2e/fixtures/test.png"));
    const wiersz = page.locator('[data-ui="document-row"]').filter({ hasText: "test.png" }).first();
    await expect(wiersz).toBeVisible({ timeout: 30_000 });
    await expect(wiersz).toContainText("(ja)");

    // Pobranie mija po podpisanym URL — zapisujemy plik, nie otwieramy karty.
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), wiersz.getByRole("button", { name: /^Pobierz/ }).click()]);
    expect(download.suggestedFilename()).toBe("test.png");

    // Dostęp da się zmienić w wierszu.
    await wiersz.getByLabel(/^Dostęp do/).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    void osoba;

    // Usuń — i nie ma go na liście.
    page.once("dialog", (d) => d.accept());
    await wiersz.getByRole("button", { name: /^Usuń/ }).click();
    await expect(page.locator('[data-ui="document-row"]').filter({ hasText: "test.png" })).toHaveCount(0, { timeout: 20_000 });
  });
});
