import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

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
  // Same budget as waitForTable below: the board header streams in with the
  // page, and under full-suite load the default 5 s expect timeout is the only
  // thing that fails here.
  await expect(page.locator('[data-ui="board-tabs"]')).toBeVisible({ timeout: 15_000 });
  await waitForTable(page);
}

// The table streams in after the board header (table/loading.tsx skeleton);
// on `next dev` that can exceed the 5s default expect timeout.
export async function waitForTable(page: Page) {
  // Desktop renders a <table>; below 768px the Lista is a card list (B1-mobile).
  await expect(
    page.locator('table thead th, [data-ui="list-mobile"] [data-ui="list-row"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

export function boardTab(page: Page, name: ViewName) {
  return page.locator('[data-ui="board-tabs"]').getByRole("tab", { name, exact: true });
}

export async function openView(page: Page, name: ViewName) {
  await boardTab(page, name).click();
  await page.waitForURL(VIEW_URL[name]);
}

// Task panel (B2) = the 600px side sheet with data-ui="task-panel" (mobile: full-screen, same attribute).
export function taskDrawer(page: Page) {
  return page.locator('[data-ui="task-panel"]');
}

// From the list view: click the first task link → intercepting-route side panel.
export async function openFirstTask(page: Page) {
  const link = page.locator('[data-ui="list-row"] a[href*="/t/"], table tbody tr a[href*="/t/"]').first();
  const drawer = taskDrawer(page);

  // Two ways the first click can be lost while the list is still streaming:
  // it lands mid-reconcile and never navigates, or it navigates but the
  // intercepting slot never mounts. Go back and click again for either.
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    try {
      await page.waitForURL(/\/t\//, { timeout: 5_000 });
      await expect(drawer).toBeVisible({ timeout: 8_000 });
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      if (/\/t\//.test(page.url())) await page.goBack({ waitUntil: "domcontentloaded" });
      await waitForTable(page);
    }
  }
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer.getByLabel("Tytuł zadania")).toBeVisible({ timeout: 15_000 });
  return drawer;
}


// View config (filters/groupBy/widths) is persisted per view and shared by every
// spec on the seed board — a spec that groups or filters would hide rows for the
// next one. Call in beforeAll where a clean, ungrouped table is required.
export function resetFixtures() {
  execFileSync("npx", ["tsx", "e2e/reset-fixtures.ts"], { stdio: "ignore" });
}
