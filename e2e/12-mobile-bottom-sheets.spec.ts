import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openFirstTask } from "./helpers";

// 12 — Mobile-only project (iPhone 12 / WebKit, see playwright.config.ts).

test.describe("mobile bottom sheets", () => {
  test("mobile sidebar drawer has solid background (F12-K84/K94)", async ({ page }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Przełącz pasek boczny" }).click();
    const drawer = page.locator('[data-ui="mobile-drawer"]');
    await expect(drawer).toBeVisible();

    // "rgb(r, g, b)" is opaque; for "rgba(...)" the alpha must be ~1.
    const bg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor);
    const alpha = bg.match(/^rgba\([^)]*,\s*([0-9.]+)\)$/)?.[1];
    expect(alpha === undefined || Number(alpha) >= 0.95, `background-color was ${bg}`).toBe(true);
  });

  test("date picker opens as a bottom sheet, not a popover", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    await page.getByRole("button", { name: "Data startu" }).click();
    const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[role="grid"]')).toBeVisible();

    // Anchored to the bottom edge and fully inside the viewport. Poll: the
    // sheet slides in (translate-y transition) and toBeVisible passes mid-animation.
    const viewport = page.viewportSize()!;
    const edges = async () => {
      const box = (await sheet.boundingBox())!;
      return { top: box.y, bottom: box.y + box.height };
    };
    await expect.poll(async () => (await edges()).bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect((await edges()).top).toBeGreaterThan(viewport.height / 3);
  });
  // Otwarcie zadania z tablicy: edytor komentarza powstaje zanim `useIsMobile`
  // przełączy się po hydratacji. Zostawał wtedy przy dłuższym, desktopowym
  // placeholderze, który zawijał się na drugą linię i wychodził pod ramkę.
  test("pole komentarza mieści placeholder w jednej linii", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    const composer = page.locator('[data-ui="comment-composer"]');
    await expect(composer).toBeVisible();
    const empty = composer.locator("p.is-editor-empty");
    await expect(empty).toHaveAttribute("data-placeholder", "Napisz komentarz…");

    // Ramka zostaje jednoliniowa, a placeholder nigdy się nie zawija — nawet
    // gdyby tekst był dłuższy niż pole.
    const box = composer.locator("[data-variant] > div").first();
    await expect(box).toHaveCSS("min-height", "44px");
    expect(await box.evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(44);
    const ws = await empty.evaluate((el) => getComputedStyle(el, "::before").whiteSpace);
    expect(ws).toBe("nowrap");
  });
  // Ikony w pasku zadania stały obok 44px "Wstecz" w rozmiarze 28px — trudno
  // w nie trafić kciukiem. Makieta B2-mobile daje im 44px i ikonę 18px.
  test("przyciski w pasku zadania maja 44px", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    const header = page.locator('[data-ui="task-header"]');
    await expect(header).toBeVisible();
    const buttons = await header.locator("button").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute("aria-label"), w: Math.round(r.width), h: Math.round(r.height) };
      }),
    );
    expect(buttons.length).toBeGreaterThan(1);
    for (const b of buttons) {
      expect(b.w, `${b.label} ma ${b.w}px szerokosci`).toBeGreaterThanOrEqual(44);
      expect(b.h, `${b.label} ma ${b.h}px wysokosci`).toBeGreaterThanOrEqual(44);
    }
  });
  // `.safe-bottom` nadpisuje `p-3` z utilities, a w Safari z widocznym dolnym
  // paskiem wciecie bezpiecznego obszaru wynosi 0 — pomaranczowy przycisk
  // dotykal krawedzi ekranu i zlewal sie z paskiem przegladarki.
  test("pasek Dodaj zadanie odstaje od dolu ekranu", async ({ page }) => {
    await gotoFirstBoard(page);

    const button = page.getByRole("button", { name: "Dodaj zadanie" }).last();
    await expect(button).toBeVisible();
    const m = await button.evaluate((el) => {
      const bar = el.parentElement!;
      const cs = getComputedStyle(bar);
      return {
        odstep: Math.round(window.innerHeight - el.getBoundingClientRect().bottom),
        borderTop: cs.borderTopWidth,
        bg: cs.backgroundColor,
      };
    });
    expect(m.odstep).toBeGreaterThanOrEqual(12);
    expect(m.borderTop).not.toBe("0px"); // pasek oddzielony od listy
  });
  // "Anuluj" / "Utworz zadanie" stały tuz przy krawedzi ekranu, pod
  // polprzezroczystym paskiem Safari (wciecie bezpiecznego obszaru = 0).
  test("stopka arkusza Nowe zadanie odstaje od dolu ekranu", async ({ page }) => {
    await gotoFirstBoard(page);
    await page.getByRole("button", { name: "Dodaj zadanie" }).last().click();

    const footer = page.locator('[data-slot="sheet-footer"]');
    await expect(footer).toBeVisible();
    // Mierzone wzgledem samej stopki, nie okna: arkusz wjezdza z dolu, wiec
    // pozycja w oknie zmienia sie w trakcie animacji.
    const odstep = await footer.evaluate((el) => {
      const dol = el.getBoundingClientRect().bottom;
      const najnizszy = Math.max(...[...el.querySelectorAll("button")].map((b) => b.getBoundingClientRect().bottom));
      return Math.round(dol - najnizszy);
    });
    expect(odstep).toBeGreaterThanOrEqual(24);
  });
  // Pole "Szukaj w tablicy" mialo na telefonie 160px w przewijanym pasku.
  // Teraz jest przyciskiem, ktory otwiera wyszukiwanie na cala szerokosc.
  test("szukanie w tablicy otwiera sie na cala szerokosc", async ({ page }) => {
    await gotoFirstBoard(page);

    // W pasku jest przycisk, nie pole.
    await expect(page.locator('[data-ui="board-search"]')).toBeHidden();
    await page.locator('[data-ui="board-search-open"]').click();

    const overlay = page.locator('[data-ui="board-search-overlay"]');
    await expect(overlay).toBeVisible();
    const m = await overlay.evaluate((el) => ({
      szerokosc: Math.round(el.getBoundingClientRect().width),
      okno: window.innerWidth,
      focus: document.activeElement === el.querySelector("input"),
    }));
    expect(m.szerokosc).toBe(m.okno);
    expect(m.focus).toBe(true);

    // Filtruje liste i wraca po wyczyszczeniu.
    const wiersze = page.locator('[data-ui="list-mobile"] a[href*="/t/"]');
    const przed = await wiersze.count();
    expect(przed).toBeGreaterThan(0);
    await overlay.locator("input").fill("zzzz-nie-istnieje");
    await expect(wiersze).toHaveCount(0);
    await overlay.getByLabel("Wyczyść wyszukiwanie").click();
    await expect(wiersze).toHaveCount(przed);

    await overlay.getByRole("button", { name: "Zamknij" }).click();
    await expect(overlay).toBeHidden();
  });
  // Paleta (lupka w gornym pasku) byla na telefonie plywajaca karta zaczynajaca
  // sie w 18% wysokosci — klawiatura zaslaniala wyniki, a jedynym wyjsciem byl
  // klawisz Esc, ktorego telefon nie ma.
  test("paleta wyszukiwania jest na telefonie pelnoekranowa", async ({ page }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Szukaj", exact: true }).click();

    const popup = page.locator("[data-fullscreen-mobile]");
    await expect(popup).toBeVisible();
    // Paleta wjezdza z zoom-in — mierzone w trakcie animacji daje przeskalowany box.
    await popup.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const m = await popup.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
        okno: window.innerWidth,
        radius: getComputedStyle(el).borderRadius,
        placeholder: el.querySelector("input")?.getAttribute("placeholder"),
      };
    });
    expect({ x: m.x, y: m.y, w: m.w }).toEqual({ x: 0, y: 0, w: m.okno });
    expect(m.radius).toBe("0px");
    expect(m.placeholder).toBe("Szukaj przestrzeni, tablicy, zadania…");

    // Wyjscie bez klawiatury sprzetowej.
    await popup.getByRole("button", { name: "Zamknij" }).click();
    await expect(popup).toBeHidden();
  });
  // Pasek statusow zjezdzal razem z kartami — po przewinieciu nie bylo widac,
  // w ktorej kolumnie sie jest. Byl przy tym sciesniony i chipy sie ucinaly.
  test("pasek statusow Tablicy zostaje widoczny przy przewijaniu", async ({ page }) => {
    await gotoFirstBoard(page);
    // Bez tego WebKit zglasza przerwane prefetche RSC z poprzedniej nawigacji.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(page.url().replace(/\/table(\?.*)?$/, "/kanban"));
    await expect(page.locator('[data-ui="kanban-mobile"]')).toBeVisible();

    const bar = page.locator('[data-ui="kanban-status-chip"]').first().locator("xpath=..");
    await expect(bar).toHaveCSS("position", "sticky");

    const m = await bar.evaluate((el) => {
      const sc = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(d).overflowY) && d.querySelector('[data-ui="kanban-mobile"]'),
      );
      sc!.scrollTop = sc!.scrollHeight;
      const b = el.getBoundingClientRect();
      const c = sc!.getBoundingClientRect();
      return {
        pasekTop: Math.round(b.top),
        kontenerTop: Math.round(c.top),
        klient: el.clientHeight,
        tresc: el.scrollHeight,
      };
    });
    // Po przewinieciu do konca pasek dalej stoi przy gornej krawedzi listy.
    expect(m.pasekTop).toBeGreaterThanOrEqual(m.kontenerTop - 1);
    // I nie jest scisniety — chipy nie moga byc ucinane.
    expect(m.klient).toBe(m.tresc);
  });
  // Po wdrozeniu otwarta karta prosi o nazwy plikow, ktorych juz nie ma. Panel
  // zadania dociaga kod leniwie, wiec obrywal pierwszy: klikniecie zmienialo
  // adres, ale zamiast zadania pokazywal sie blad i pomagalo tylko odswiezenie.
  test("zadanie otwiera sie mimo nieaktualnych plikow po wdrozeniu", async ({ page, consoleErrors }) => {
    await gotoFirstBoard(page);
    await expect(page.locator('a[href*="/t/"]').first()).toBeVisible();

    // Serwer "po wdrozeniu": stare nazwy chunkow znikaja.
    await page.route("**/_next/static/chunks/**", (route) => route.fulfill({ status: 404, body: "" }));
    await page.locator('a[href*="/t/"]').first().click();
    await page.waitForTimeout(1500);
    // Twarde przejscie dostaje juz swiezy kod, tak jak realny serwer.
    await page.unroute("**/_next/static/chunks/**");

    await expect(page.locator('[data-ui="task-detail"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Nie udało się załadować zadania")).toBeHidden();

    // 404 na plikach i ChunkLoadError wywolalismy sami — reszta bledow ma dalej
    // wywalac test.
    const nasze = /404 \(Not Found\)|ChunkLoadError|\[TaskModal\] render failed|\[AppError\]/;
    const obce = consoleErrors.filter((e) => !nasze.test(e));
    consoleErrors.length = 0;
    consoleErrors.push(...obce);
  });
  // Punktor w opisie dzialal, ale przycisk mial 24px i 2px przerwy do sasiadow —
  // palcem trafialo sie w przekreslenie albo liste numerowana. Stad zgloszenie
  // „nie dziala opcja punktora".
  test("przyciski paska formatowania w opisie sa trafialne palcem", async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);

    const opis = page.locator('[data-ui="task-description"]');
    await opis.getByRole("button", { name: /Edytuj opis/i }).first().click();
    const punktor = opis.getByRole("button", { name: "Lista punktowa" });
    await expect(punktor).toBeVisible();

    const m = await opis.evaluate((el) => {
      const b = [...el.querySelectorAll("button[aria-label]")];
      const i = b.findIndex((x) => x.getAttribute("aria-label") === "Lista punktowa");
      const r = (n?: Element) => n?.getBoundingClientRect();
      const me = r(b[i])!, prev = r(b[i - 1]), next = r(b[i + 1]);
      return {
        w: Math.round(me.width),
        h: Math.round(me.height),
        odstepy: [prev ? Math.round(me.left - prev.right) : 99, next ? Math.round(next.left - me.right) : 99],
      };
    });
    expect(m.w).toBeGreaterThanOrEqual(36);
    expect(m.h).toBeGreaterThanOrEqual(36);
    expect(Math.min(...m.odstepy)).toBeGreaterThanOrEqual(4);

    // I nadal robi to, co ma robic.
    await page.locator('[data-ui="task-description"] [contenteditable="true"]').click();
    await punktor.click();
    await expect(page.locator('[data-ui="task-description"] [contenteditable="true"] ul li')).toHaveCount(1);
  });
});
