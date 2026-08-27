import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openView, waitForTable } from "./helpers";

// F6 hardening — AK189 (mobile 390), AK190 (axe + klawiatura).
// AK187 (uprawnienia VIEWER) nie jest tu automatyzowany: seed nie zakłada
// użytkownika z rolą VIEWER, a testy nie mogą pisać po `prisma/`.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];


async function seriousViolations(page: Page) {
  // Skanuj dopiero, gdy arkusz jest zastosowany. Bez tego axe łapie stan sprzed
  // podpięcia stylów i zgłasza kilkadziesiąt fałszywych naruszeń kontrastu —
  // za każdym przebiegiem na innym kroku i w innym kolorze, zależnie od tego,
  // co zdążyło się doczytać.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue("--fg-3").trim().length > 0 &&
      // Przejście widoku to 200 ms fade — w jego trakcie tła są półprzezroczyste
      // i axe wylicza kontrast z niedomalowanego stanu. Bez tego test wywalał się
      // za każdym przebiegiem na innym kroku i innej liczbie węzłów (7/28/51/59).
      document.getAnimations().every((a) => a.playState !== "running"),
    null,
    { timeout: 10_000 },
  );
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
}

test.describe("AK190 — dostępność", () => {
  test("ekran logowania bez naruszeń serious/critical", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/secure-access-portal");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("Lista, Tablica, panel zadania i Powiadomienia bez naruszeń serious/critical", async ({ page }) => {
    await gotoFirstBoard(page);
    expect(await seriousViolations(page), "Lista").toEqual([]);

    await openView(page, "Tablica");
    await expect(page.locator('[data-ui="kanban-column"]').first()).toBeVisible();
    expect(await seriousViolations(page), "Tablica").toEqual([]);

    await openView(page, "Lista");
    await waitForTable(page);
    await page.locator('[data-ui="list-row"] a[href*="/t/"]').first().click();
    await expect(page.locator('[data-ui="task-panel"]')).toBeVisible({ timeout: 15_000 });
    expect(await seriousViolations(page), "panel zadania").toEqual([]);

    await page.goto("/inbox");
    await expect(page.locator('[data-ui="main"]')).toBeVisible();
    expect(await seriousViolations(page), "Powiadomienia").toEqual([]);
  });

  test("klawiatura: Tab dochodzi do menu Utwórz, panel zadania otwiera się i zamyka Esc", async ({ page }) => {
    await gotoFirstBoard(page);

    // Tab od początku dokumentu — „Utwórz" jest czwartym przystankiem w top barze.
    await page.evaluate(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
    });
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => /Utwórz/.test(document.activeElement?.textContent ?? ""));
    }
    expect(reached, "Tab nie dochodzi do przycisku Utwórz").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page.locator('[data-ui="create-menu"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await page.locator('[data-ui="list-row"] a[href*="/t/"]').first().focus();
    await page.keyboard.press("Enter");
    const panel = page.locator('[data-ui="task-panel"]');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });
});

test.describe("AK189 — mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Trasy tablicy trzymają scroll poziomy wewnątrz widoku; dokument nie może
  // się rozjeżdżać na żadnej z nich (F5: `overflow-x-hidden` zawężony do tablic).
  for (const view of ["Lista", "Tablica", "Roadmapa", "Opis"] as const) {
    test(`${view} nie rozpycha dokumentu`, async ({ page }) => {
      await gotoFirstBoard(page);
      await openView(page, view);
      await expect(page.locator('[data-ui="board-tabs"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  }

  for (const path of ["/inbox", "/my-tasks", "/workspaces", "/profile"]) {
    test(`${path} nie rozpycha dokumentu`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('[data-ui="main"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  }
});
