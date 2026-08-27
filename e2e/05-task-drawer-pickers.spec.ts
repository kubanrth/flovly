import path from "node:path";
import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openFirstTask, taskDrawer , resetFixtures } from "./helpers";

// 05 — task side panel (B2): geometry, header order, sections, every picker opens
// above the list (F12-K101 regression), inline edits round-trip.

test.describe("task panel (B2)", () => {
  test.beforeAll(() => resetFixtures());
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);
  });

  test("AK63: 600px panel, shadow, no scrim, list underneath still clickable", async ({ page }) => {
    const panel = taskDrawer(page);
    const box = (await panel.boundingBox())!;
    expect(Math.abs(box.width - 600)).toBeLessThanOrEqual(2);
    expect(await panel.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    await expect(page.locator(".bg-scrim")).toHaveCount(0);
    await expect(page).toHaveURL(/\/t\/[A-Za-z0-9_-]+/);
    const first = await panel.getByLabel("Tytuł zadania").inputValue();
    const links = page.locator('[data-ui="list-row"] a[href*="/t/"], table tbody tr a[href*="/t/"]');
    if ((await links.count()) > 1) {
      await links.nth(1).click();
      await expect(panel.getByLabel("Tytuł zadania")).not.toHaveValue(first, { timeout: 15_000 });
    }
  });

  test("AK64: header order — #ID, status, priority, mail, move, expand, more, close", async ({ page }) => {
    const header = taskDrawer(page).locator('[data-ui="task-header"]');
    await expect(header.locator("span").first()).toHaveText(/^#\d+/);
    const names = await header.locator("button").evaluateAll((els) => els.map((b) => b.getAttribute("aria-label") ?? b.getAttribute("title") ?? ""));
    const expected = ["Zmień status", "Zmień priorytet", "Wyślij mailem", "Przenieś", "Pełny widok", "Więcej", "Zamknij"];
    expect(names.filter((n) => expected.includes(n))).toEqual(expected);
  });

  test("AK65: section eyebrows, activity tabs, details labels in order", async ({ page }) => {
    const panel = taskDrawer(page);
    const eyebrows = await panel.locator('[data-ui="task-detail"] > div .eyebrow').evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    const main = eyebrows.filter((t) => /^(Opis|Podzadania|Załączniki|Powiązane zadania|Głosowanie)/.test(t)).map((t) => t.split(" ·")[0]);
    expect(main).toEqual(["Opis", "Podzadania", "Załączniki", "Powiązane zadania", "Głosowanie"]);
    await expect(panel.locator('[data-ui="task-activity"] [role="tab"]')).toHaveText(["Wszystko", "Komentarze", "Historia", "Czas pracy"]);
    const labels = await panel.locator('[data-ui="task-details"] .text-2xs.text-fg-3').evaluateAll((els) => els.map((e) => e.textContent!.trim()));
    for (const l of ["Przypisani", "Milestone", "Tagi", "Przypomnienie", "Cykliczność", "Timer", "Pola dodatkowe", "Widoki", "Utworzono", "Zaktualizowano"]) expect(labels).toContain(l);
    // AK65: „Start · Koniec" (modal/page) or separate Start / Koniec rows (600 panel, as in B2-panel).
    expect(labels.includes("Start · Koniec") || (labels.includes("Start") && labels.includes("Koniec"))).toBe(true);
    expect(labels.indexOf("Przypisani")).toBeLessThan(labels.indexOf("Widoki"));
    await expect(panel.getByRole("switch", { name: "Ukryj puste pola" })).toBeVisible();
  });

  test("status picker — opens above the panel", async ({ page }) => {
    await taskDrawer(page).getByTitle("Zmień status").click();
    await expect(page.getByRole("menuitemradio").first()).toBeVisible();
  });

  test("priority picker — opens", async ({ page }) => {
    await taskDrawer(page).getByTitle("Zmień priorytet").click();
    await expect(page.getByRole("menuitemradio").first()).toBeVisible();
  });

  test("start / end date pickers — calendar visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Data startu" }).click();
    await expect(page.locator('.rdp-host [role="grid"]').last()).toBeVisible();
    await page.keyboard.press("Escape");
    await taskDrawer(page).getByRole("button", { name: "Data końca" }).click();
    await expect(page.locator('.rdp-host [role="grid"]').last()).toBeVisible();
  });

  test("assignees picker — member search visible (+ M hotkey)", async ({ page }) => {
    await taskDrawer(page).locator('[data-field="assignees"] [aria-haspopup]').first().click();
    await expect(page.getByPlaceholder("Szukaj osoby…")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Szukaj osoby…")).toBeHidden();
    await taskDrawer(page).getByLabel("Tytuł zadania").blur();
    await page.keyboard.press("m");
    await expect(page.getByPlaceholder("Szukaj osoby…")).toBeVisible();
  });

  test("tags picker — tag search visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: /dodaj tag/i }).click();
    await expect(page.getByLabel("Szukaj tagu")).toBeVisible();
  });

  test("milestone picker — opens", async ({ page }) => {
    await taskDrawer(page).getByLabel("Wybierz milestone").click();
    await expect(page.getByRole("option").or(page.getByText("Utwórz milestone w roadmapie")).first()).toBeVisible();
  });

  test("recurrence picker — radiogroup in popover", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Cykliczność", exact: true }).click();
    const group = page.getByRole("radiogroup", { name: "Częstotliwość powtarzania" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: "Co tydzień" })).toBeVisible();
  });

  test("reminder picker — presets in popover", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Przypomnienie", exact: true }).click();
    const group = page.getByRole("radiogroup", { name: "Czas przypomnienia" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: "1 h" })).toBeVisible();
  });

  test("AK66: title autosave on blur (F12-K96)", async ({ page }) => {
    test.slow(); // types char-by-char twice, reloads to prove persistence
    const title = () => taskDrawer(page).getByLabel("Tytuł zadania");
    const original = await title().inputValue();

    // Enter blurs → patchTaskAction. Two server-action POSTs fly (version
    // pre-check, then the patch), so don't race them with a reload — poll the
    // persisted value instead.
    const retype = async (value: string) => {
      const box = page.getByLabel("Tytuł zadania");
      await box.click();
      await page.keyboard.press("ControlOrMeta+a");
      // Real typing: the textarea is uncontrolled and a concurrent
      // router.refresh() can remount it, discarding a programmatic fill().
      await box.pressSequentially(value);
      await box.press("Enter");
      // Two server-action POSTs fly (version pre-check, then the patch); let
      // them finish before reloading, or the reload aborts the save.
      await page.waitForLoadState("networkidle");
      await expect
        .poll(async () => {
          await page.reload();
          return page.getByLabel("Tytuł zadania").inputValue();
        }, { timeout: 20_000, intervals: [1000, 2000, 2000, 3000] })
        .toBe(value);
    };

    await retype(`autosave-${Date.now()}`);
    await retype(original); // leave the seed task as we found it
  });

  test("AK68: subtask add → toggle → progress → delete", async ({ page }) => {
    const panel = taskDrawer(page);
    const sub = panel.locator('[data-ui="task-subtasks"]');
    const name = `AK68-${Date.now()}`;
    await sub.getByRole("button", { name: "Dodaj podzadanie" }).click();
    await sub.getByLabel("Tytuł podzadania").fill(name);
    await sub.getByRole("button", { name: "Dodaj", exact: true }).click();
    const row = sub.locator("li").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("checkbox").click();
    await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    await expect(sub.locator("span.font-mono")).toHaveText(/^\d+\/\d+$/);
    const fill = sub.locator('[role="progressbar"] > span');
    await expect.poll(async () => fill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(30, 158, 90)");
    await row.getByRole("button", { name: `Usuń podzadanie: ${name}` }).click();
    await expect(row).toBeHidden({ timeout: 15_000 });
  });

  test("AK69: attachment upload — png thumb 120×80, svg download-only, delete", async ({ page }) => {
    const panel = taskDrawer(page);
    const input = panel.locator('input[type="file"][aria-label="Dodaj załącznik"]');
    await input.setInputFiles(path.resolve("e2e/fixtures/test.png"));
    const thumb = panel.locator('figure img[alt="test.png"]');
    await expect(thumb).toBeVisible({ timeout: 30_000 });
    const box = (await thumb.boundingBox())!;
    expect(Math.round(box.width)).toBe(120);
    expect(Math.round(box.height)).toBe(80);
    await input.setInputFiles(path.resolve("e2e/fixtures/test.svg"));
    await expect(panel.locator('a[download="test.svg"]')).toBeVisible({ timeout: 30_000 });
    await panel.getByRole("button", { name: "Usuń test.svg" }).click();
    await expect(panel.locator('a[download="test.svg"]')).toBeHidden({ timeout: 15_000 });
    await panel.getByRole("button", { name: "Usuń test.png" }).click(); // opacity-0 until hover, still clickable
    await expect(thumb).toBeHidden({ timeout: 15_000 });
  });

  test("AK70: poll create → vote → close → delete", async ({ page }) => {
    const poll = taskDrawer(page).locator('[data-ui="task-poll"]');
    if (await poll.getByRole("button", { name: "Usuń" }).isVisible()) {
      await poll.getByRole("button", { name: "Usuń" }).click();
      await expect(poll.getByRole("button", { name: "Utwórz głosowanie" })).toBeVisible({ timeout: 15_000 });
    }
    await poll.getByRole("button", { name: "Utwórz głosowanie" }).click();
    await poll.getByPlaceholder("Który wariant wybieramy?").fill("AK70?");
    await poll.getByLabel("Opcja 1").fill("Tak");
    await poll.getByLabel("Opcja 2").fill("Nie");
    await poll.getByRole("button", { name: "Utwórz", exact: true }).click();
    await expect(poll.getByText("AK70?")).toBeVisible({ timeout: 15_000 });
    await poll.getByRole("radio", { name: /Tak/ }).click();
    await expect(poll.getByText("1 głos").first()).toBeVisible({ timeout: 15_000 });
    await poll.getByRole("button", { name: "Zamknij" }).click();
    await expect(poll.getByText(/zamknięte/)).toBeVisible({ timeout: 15_000 });
    await poll.getByRole("button", { name: "Usuń" }).click();
    await expect(poll.getByRole("button", { name: "Utwórz głosowanie" })).toBeVisible({ timeout: 15_000 });
  });

  test("AK74: Esc closes the panel back to the list URL", async ({ page }) => {
    await taskDrawer(page).getByLabel("Tytuł zadania").blur();
    await page.keyboard.press("Escape");
    await expect(taskDrawer(page)).toBeHidden();
    await expect(page).toHaveURL(/\/table(\?|$)/);
  });
});
