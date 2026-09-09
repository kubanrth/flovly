import { test, expect, type Browser, type Page } from "@playwright/test";

// F14 „Zarządzanie dostępem" — sprawdzian na dwóch kontach naraz: admin nadaje
// dostęp, a druga przeglądarka (Piotr, MEMBER) sprawdza, co widzi.
// Dane z demo (`npm run seed:demo`): przestrzeń „Agencja Nova", tablica
// „Kampania Q4", hasła/kontakty/whiteboard założone przez admina.
//
// Każdy test sprząta po sobie (czyści listę dostępu), żeby kolejność testów
// nie miała znaczenia.

const CZLONEK = { email: "piotr@nova-demo.local", haslo: "danielos-demo-2026", imie: "Piotr Zieliński" };
const KASIA = "Kasia Nowak";

async function otworzNove(page: Page): Promise<string> {
  await page.goto("/workspaces");
  await page.getByRole("link", { name: /Agencja Nova/ }).first().click();
  await page.waitForURL(/\/w\/[^/]+/);
  return new URL(page.url()).pathname.split("/")[2]!;
}

async function zalogujCzlonka(browser: Browser) {
  // Czysta sesja — `newContext()` bez tego dziedziczy ciasteczka admina z projektu.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/secure-access-portal");
  await page.locator('input[name="email"]').fill(CZLONEK.email);
  await page.locator('input[name="haslo"], input[name="password"]').first().fill(CZLONEK.haslo);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/workspaces/);
  // Piotr loguje się pierwszy raz — powitalny tour przykrywa treść.
  const pomin = page.getByRole("button", { name: "Pomiń" });
  if (await pomin.isVisible().catch(() => false)) await pomin.click();
  await expect(pomin).toBeHidden();
  return { context, page };
}

/** Ustawia listę „kto to widzi" dla obiektu o tej nazwie. Pusta lista = wyczyść. */
async function ustawDostep(page: Page, nazwa: string, osoby: string[]) {
  const dialog = page.locator('[data-ui="access-dialog"]');
  // Sprzątanie po nieudanym teście: otwarty dialog przechwytuje kliknięcia.
  if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: `Dostęp do „${nazwa}”` }).first().click();
  await expect(dialog).toBeVisible();
  const wyczysc = dialog.getByRole("button", { name: "Wyczyść" });
  if (await wyczysc.isVisible().catch(() => false)) await wyczysc.click();
  // Nazwa dostępna przycisku to „P Piotr Zieliński" (inicjał z awatara), więc bez `exact`.
  for (const osoba of osoby) await dialog.getByRole("button", { name: osoba }).click();
  await dialog.getByRole("button", { name: "Zapisz dostęp" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("F14 dostępy per obiekt", () => {
  test("Hasła: wpis prywatny do czasu udostępnienia", async ({ page, browser }) => {
    const ws = await otworzNove(page);
    await page.goto(`/w/${ws}/passwords`);
    await expect(page.getByText("Google Ads — konto agencyjne")).toBeVisible();

    const czlonek = await zalogujCzlonka(browser);
    try {
      await czlonek.page.goto(`/w/${ws}/passwords`);
      // Piotr jest właścicielem tylko wpisu „Hosting".
      await expect(czlonek.page.getByText("Hosting — panel klienta")).toBeVisible();
      await expect(czlonek.page.getByText("Google Ads — konto agencyjne")).toHaveCount(0);

      await ustawDostep(page, "Google Ads — konto agencyjne", [CZLONEK.imie]);
      await czlonek.page.reload();
      await expect(czlonek.page.getByText("Google Ads — konto agencyjne")).toBeVisible();
    } finally {
      await ustawDostep(page, "Google Ads — konto agencyjne", []);
      await czlonek.context.close();
    }
  });

  test("Whiteboardy: udostępniony whiteboard pojawia się u członka", async ({ page, browser }) => {
    const ws = await otworzNove(page);
    const nazwa = "Ścieżka klienta — rezerwacja";
    await page.goto(`/w/${ws}/canvases`);
    await expect(page.getByText(nazwa)).toBeVisible();

    const czlonek = await zalogujCzlonka(browser);
    try {
      await czlonek.page.goto(`/w/${ws}/canvases`);
      await expect(czlonek.page.getByText(nazwa)).toHaveCount(0);

      await ustawDostep(page, nazwa, [CZLONEK.imie]);
      await czlonek.page.reload();
      await expect(czlonek.page.getByText(nazwa)).toBeVisible();
      await czlonek.page.getByRole("link", { name: "Otwórz" }).first().click();
      await czlonek.page.waitForURL(/\/c\/[^/]+/);
      await expect(czlonek.page.getByRole("heading", { name: nazwa })).toBeVisible();
    } finally {
      await ustawDostep(page, nazwa, []);
      await czlonek.context.close();
    }
  });

  test("Kontakty: udostępniony kontakt pojawia się u członka", async ({ page, browser }) => {
    // Kontakt „Robert Krawczyk" (Meblo Studio) ma opiekuna admina, „Marek Lis"
    // (Dentalux) — Piotra. Kartę otwiera się klikając wiersz w tabeli.
    const ws = await otworzNove(page);
    await page.goto(`/w/${ws}/contacts`);
    await page.locator("table").getByText("Robert Krawczyk").first().click();
    await expect(page.locator('[data-ui="contact-panel"]')).toBeVisible();

    const czlonek = await zalogujCzlonka(browser);
    try {
      await czlonek.page.goto(`/w/${ws}/contacts`);
      await expect(czlonek.page.locator("table").getByText("Marek Lis").first()).toBeVisible();
      await expect(czlonek.page.locator("table").getByText("Robert Krawczyk")).toHaveCount(0);

      await ustawDostep(page, "Robert Krawczyk", [CZLONEK.imie]);
      await czlonek.page.reload();
      await expect(czlonek.page.locator("table").getByText("Robert Krawczyk").first()).toBeVisible();
    } finally {
      await ustawDostep(page, "Robert Krawczyk", []);
      await czlonek.context.close();
    }
  });

  test("Subskrypcje: zawężenie ukrywa wiersz i kwotę", async ({ page, browser }) => {
    const ws = await otworzNove(page);
    const nazwa = "Canva Teams";
    await page.goto(`/w/${ws}/subscriptions`);
    await expect(page.locator(`input[value="${nazwa}"]`)).toBeVisible();

    const czlonek = await zalogujCzlonka(browser);
    try {
      await czlonek.page.goto(`/w/${ws}/subscriptions`);
      await expect(czlonek.page.locator(`input[value="${nazwa}"]`)).toBeVisible();

      // Zawężenie do Kasi — Piotra nie ma na liście, więc wiersz mu znika.
      await ustawDostep(page, nazwa, [KASIA]);
      await czlonek.page.reload();
      await expect(czlonek.page.locator(`input[value="${nazwa}"]`)).toHaveCount(0);
    } finally {
      await ustawDostep(page, nazwa, []);
      await czlonek.context.close();
    }
  });

  test("Widok tablicy: zawężony widok znika z paska członka", async ({ page, browser }) => {
    const ws = await otworzNove(page);
    const nazwaWidoku = `Dostęp ${Date.now().toString().slice(-5)}`;
    await page.goto(`/w/${ws}`);
    await page.locator('a[href*="/b/"]').first().click();
    await page.waitForURL(/\/b\/[^/]+\//);
    const adresTablicy = page.url();

    // Nowy widok własny — tylko takie da się zawęzić (domyślne zakładki zostają).
    await page.getByRole("button", { name: "Nowy widok" }).click();
    const nowy = page.getByRole("dialog");
    await nowy.getByRole("radio", { name: /Lista/ }).click();
    await nowy.getByLabel("Nazwa widoku").fill(nazwaWidoku);
    await nowy.getByRole("button", { name: "Utwórz widok" }).click();
    await page.waitForURL(/\/v\/[^/]+/);
    const adresWidoku = page.url();

    const czlonek = await zalogujCzlonka(browser);
    try {
      await czlonek.page.goto(adresTablicy);
      await expect(czlonek.page.locator('[data-ui="board-tabs"]').getByText(nazwaWidoku)).toBeVisible();

      await ustawDostep(page, nazwaWidoku, [KASIA]);
      await czlonek.page.goto(adresTablicy);
      await expect(czlonek.page.locator('[data-ui="board-tabs"]').getByText(nazwaWidoku)).toHaveCount(0);

      // Adres wpisany z ręki też nie działa.
      await czlonek.page.goto(adresWidoku);
      await expect(czlonek.page.getByText(nazwaWidoku)).toHaveCount(0);
    } finally {
      await page.goto(adresWidoku);
      await page.getByRole("button", { name: `Opcje widoku ${nazwaWidoku}` }).click();
      await page.getByRole("menuitem", { name: "Usuń widok" }).click();
      await czlonek.context.close();
    }
  });

  test("Zadania: zawężone zadanie znika z listy członka", async ({ page, browser }) => {
    const ws = await otworzNove(page);
    const tytul = "Nota prasowa — otwarcie ogródka zimowego";
    await page.goto(`/w/${ws}`);
    await page.locator('a[href*="/b/"]').first().click();
    await page.waitForURL(/\/b\/[^/]+\/(table|kanban|roadmap|overview)/);
    await page.getByText(tytul).first().click();
    await page.waitForURL(/\/t\/[^/]+/);

    const czlonek = await zalogujCzlonka(browser);
    try {
      await ustawDostep(page, tytul, [KASIA]);
      await czlonek.page.goto(page.url().replace(/\/t\/.*$/, ""));
      await expect(czlonek.page.getByText(tytul)).toHaveCount(0);
    } finally {
      await ustawDostep(page, tytul, []);
      await czlonek.context.close();
    }
  });
});
