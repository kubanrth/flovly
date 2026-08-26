// Pure numbers and strings for the workspace overview (C1).
// Self-check: `npx tsx components/workspace/overview-model.check.ts`.
import { makeIsDone, type DoneColumn } from "@/components/board/done-status";
import { activityTime } from "@/components/summary/aggregate";
import { boardPl, plPlural, taskPl } from "@/lib/pluralize";

export interface OverviewTask {
  statusColumnId: string | null;
  /** ISO string; `null` = no due date. */
  stopAt: string | null;
}

export interface BoardStats {
  done: number;
  total: number;
  open: number;
  overdue: number;
  /** done / total, 0 for an empty board. */
  share: number;
  /** Earliest upcoming due date among open tasks (ISO), `null` when there is none. */
  nextDue: string | null;
}

/** „done/total” + „N po terminie” per board card. „Ukończone” = the shared rule in board/done-status. */
export function boardStats(tasks: OverviewTask[], columns: DoneColumn[], now: Date): BoardStats {
  const isDone = makeIsDone(columns);
  let done = 0;
  let overdue = 0;
  let nextDue: string | null = null;
  for (const t of tasks) {
    if (isDone(t.statusColumnId)) {
      done += 1;
      continue;
    }
    if (!t.stopAt) continue;
    if (new Date(t.stopAt).getTime() < now.getTime()) overdue += 1;
    else if (nextDue === null || t.stopAt < nextDue) nextDue = t.stopAt;
  }
  const total = tasks.length;
  return { done, total, open: total - done, overdue, share: total === 0 ? 0 : done / total, nextDue };
}

/** Progress bar colour. Mockup C1: 8/20 and 25/34 green, 2/13 blue → a quarter is the line. */
export function progressTone(share: number): "success" | "info" {
  return share >= 0.25 ? "success" : "info";
}

export const personPl = (n: number) => plPlural(n, "osoba", "osoby", "osób");
export const openPl = (n: number) => plPlural(n, "otwarte", "otwarte", "otwartych");

/** „3 tablice · 7 osób · utworzona 12 maja 2026” */
export function workspaceMeta(boardCount: number, memberCount: number, createdAt: Date): string {
  const date = createdAt.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  return `${boardCount} ${boardPl(boardCount)} · ${memberCount} ${personPl(memberCount)} · utworzona ${date}`;
}

/** „3 tablice · 67 zadań łącznie · 35 otwartych” */
export function overviewFooter(boardCount: number, totalTasks: number, openTasks: number): string {
  return `${boardCount} ${boardPl(boardCount)} · ${totalTasks} ${taskPl(totalTasks)} łącznie · ${openTasks} ${openPl(openTasks)}`;
}

/** „wczoraj 16:40” / „pon 09:18” / „16:40” (dziś). */
export function activityStamp(at: Date, now: Date): string {
  const time = at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const day = activityTime(at, now);
  return day === time ? time : `${day} ${time}`;
}

// Shape stored in localStorage `ui:starred` / `ui:recent` (SHELL-API).
export interface SavedItem {
  type: "board" | "task";
  id: string;
  label: string;
  href: string;
}

export const isSaved = (list: SavedItem[], item: Pick<SavedItem, "type" | "id">) =>
  list.some((i) => i.type === item.type && i.id === item.id);

/** Toggle: newest first, so the sidebar lists the most recently starred board on top. */
export function toggleSaved(list: SavedItem[], item: SavedItem): SavedItem[] {
  return isSaved(list, item) ? list.filter((i) => !(i.type === item.type && i.id === item.id)) : [item, ...list];
}
