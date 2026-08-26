import { test, expect } from "./fixtures/console-errors";
import { gotoFirstBoard, openFirstTask, taskDrawer } from "./helpers";

// 05 — MOST IMPORTANT regression suite (F12-K101 z-index stacking).
// Open an existing task drawer, then verify each picker popover is visible
// (a popover under the backdrop renders but never becomes "visible" to
// Playwright's hit-testing, so toBeVisible on its content is the assertion).

test.describe("task drawer pickers (F12-K101 regression)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFirstBoard(page);
    await openFirstTask(page);
  });

  test("status picker — opens, options visible above backdrop", async ({ page }) => {
    await taskDrawer(page).locator('button[aria-haspopup="listbox"]').first().click();
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("priority picker — opens", async ({ page }) => {
    await taskDrawer(page).locator('button[title="Zmień priorytet"]').click();
    await expect(page.getByRole("menuitemradio").first()).toBeVisible();
  });

  test("start date picker — calendar visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Data startu" }).click();
    await expect(page.locator('.rdp-host [role="grid"]').last()).toBeVisible();
  });

  test("end date picker — calendar visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Data końca" }).click();
    await expect(page.locator('.rdp-host [role="grid"]').last()).toBeVisible();
  });

  test("assignees picker — member search visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: "Dodaj osobę" }).click();
    await expect(page.getByLabel("Szukaj osoby")).toBeVisible();
  });

  test("tags picker — tag search visible", async ({ page }) => {
    await taskDrawer(page).getByRole("button", { name: /dodaj tag/i }).click();
    await expect(page.getByLabel("Szukaj tagu")).toBeVisible();
  });

  test("milestone picker — opens", async ({ page }) => {
    await taskDrawer(page).getByLabel("Wybierz milestone").click();
    // Either the option list or the empty hint (seed has no milestones).
    await expect(
      page.getByRole("option").or(page.getByText("Utwórz milestone w roadmapie")).first(),
    ).toBeVisible();
  });

  test("recurrence picker — inline radiogroup visible", async ({ page }) => {
    const group = taskDrawer(page).getByRole("radiogroup", { name: "Częstotliwość powtarzania" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: "Co tydzień" })).toBeVisible();
  });

  test("reminder picker — inline radiogroup visible", async ({ page }) => {
    const group = taskDrawer(page).getByRole("radiogroup", { name: "Czas przypomnienia" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: "1 h" })).toBeVisible();
  });

  test("title autosave on blur (F12-K96)", async ({ page }) => {
    const title = () => page.getByLabel("Tytuł zadania");
    const original = await title().inputValue();
    const newTitle = `autosave-${Date.now()}`;

    // Enter = blur → patchTaskAction, a server-action POST whose FormData
    // carries `title`. Match on the body (other actions fire while the drawer
    // is open) and wait for the streamed response to finish, not just headers.
    const save = () =>
      page.waitForResponse(
        (r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes('name="1_title"'),
      );
    await title().fill(newTitle);
    let saved = save();
    await title().press("Enter");
    await (await saved).finished();

    await page.reload();
    await expect(title()).toHaveValue(newTitle, { timeout: 10_000 });

    // Restore the seed title so the board stays stable across runs.
    await title().fill(original);
    saved = save();
    await title().press("Enter");
    await (await saved).finished();
  });
});
