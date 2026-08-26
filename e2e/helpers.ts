import { expect, type Page } from "@playwright/test";

// Shared navigation for the redesigned shell (top bar + sidebar + board header).
// Seed data guarantees: workspace "Kickback" → board "Sprint 1" with tasks and
// status columns, admin user. No precondition guards — a missing fixture is a bug.

export const VIEW_URL = {
  Lista: /\/table(\?|$)/,
  Tablica: /\/kanban(\?|$)/,
  "Oś czasu": /\/gantt(\?|$)/,
  Roadmapa: /\/roadmap(\?|$)/,
  Kalendarz: /\/calendar(\?|$)/,
  Whiteboard: /\/whiteboard(\?|$)/,
  "Linia zadań": /\/taskline(\?|$)/,
  Opis: /\/overview(\?|$)/,
} as const;
export type ViewName = keyof typeof VIEW_URL;

function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

// /workspaces → sidebar (or mobile drawer) → expand first workspace → first board → /table.
// Deliberately avoids the workspace overview page (/w/<id>).
export async function gotoFirstBoard(page: Page) {
  await page.goto("/workspaces");
  let nav = page.locator('[data-ui="sidebar"]');
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Przełącz pasek boczny" }).click();
    nav = page.locator('[data-ui="mobile-drawer"]');
  }
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: "Rozwiń tablice" }).first().click();
  await nav.locator('a[href*="/b/"]').first().click();
  await page.waitForURL(/\/b\/[^/]+\/table/);
  await expect(page.locator('[data-ui="board-tabs"]')).toBeVisible();
  await waitForTable(page);
}

// The table streams in after the board header (table/loading.tsx skeleton);
// on `next dev` that can exceed the 5s default expect timeout.
export async function waitForTable(page: Page) {
  await expect(page.locator("table thead th").first()).toBeVisible({ timeout: 15_000 });
}

export function boardTab(page: Page, name: ViewName) {
  return page.locator('[data-ui="board-tabs"]').getByRole("tab", { name, exact: true });
}

export async function openView(page: Page, name: ViewName) {
  await boardTab(page, name).click();
  await page.waitForURL(VIEW_URL[name]);
}

// Task drawer = the dialog that contains the title textarea (the Ateron AI
// panel is also a role=dialog, so never use a bare getByRole("dialog")).
export function taskDrawer(page: Page) {
  return page.getByRole("dialog").filter({ has: page.getByLabel("Tytuł zadania") });
}

// From the table view: click the first task link → intercepting-route drawer.
export async function openFirstTask(page: Page) {
  await page.locator('table tbody tr td a[href*="/t/"]').first().click();
  const drawer = taskDrawer(page);
  // Drawer streams the task RSC payload — slow on `next dev` under full-suite load.
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}
