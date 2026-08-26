// D1 „Powiadomienia” — pure helpers: day bucketing, Polish relative labels,
// tab filtering. No React, no DB: `npx tsx components/inbox/inbox-model.check.ts`.
//
// Buckets are computed on the server (page.tsx) and shipped down, so SSR and
// hydration agree even when the container runs in UTC — hence the fixed zone.

import type { TaskPriorityValue } from "@/lib/task-priority";

export type DayBucket = "today" | "yesterday" | "earlier";
export type InboxTab = "unread" | "mentions" | "assignments" | "all";

/** Task a notification points at, resolved server-side (status chip, due date, #ID). */
export interface InboxTaskRef {
  id: string;
  workspaceId: string;
  displayId: number;
  title: string;
  /** ISO; drives the „Przesuń termin” button. */
  dueAt: string | null;
  /** Preformatted overdue label („wczoraj (25 sie)”); null when the term has not passed. */
  dueText: string | null;
  priority: TaskPriorityValue;
  statusName: string | null;
  statusColor: string | null;
  /** Already-assigned people, for the `M` assign hotkey. */
  assigneeIds: string[];
}

/** One row of the feed. Everything time-dependent is preformatted server-side. */
export interface InboxItem {
  id: string;
  type: string;
  unread: boolean;
  userNote: string | null;
  bucket: DayBucket;
  /** „11:42” / „wczoraj 15:22” / „20 sie 09:00”. */
  when: string;
  /** Board name, support queue, „przypomnienie własne” — right of the time. */
  context: string | null;
  /** Person who caused the notification; null = system tile instead of an avatar. */
  actorName: string | null;
  /** Comment snippet or poll question, rendered as a quote. */
  quote: string | null;
  href: string;
  task: InboxTaskRef | null;
  /** Task title straight from the payload — survives when the task row is gone. */
  subject: string | null;
  ticketTitle: string | null;
  ticketStatus: string | null;
  fromStatusName: string | null;
  toStatusName: string | null;
}

export const INBOX_TZ = "Europe/Warsaw";

export const BUCKET_LABEL: Record<DayBucket, string> = {
  today: "Dzisiaj",
  yesterday: "Wczoraj",
  earlier: "Wcześniej",
};

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(key);
  if (!f) {
    f = make();
    FMT_CACHE.set(key, f);
  }
  return f;
}

/** Calendar day in `tz` as `YYYY-MM-DD` (sortable, comparable with `===`/`<`). */
export function calendarDay(at: string | Date, tz = INBOX_TZ): string {
  return fmt(`d:${tz}`, () =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }),
  ).format(new Date(at));
}

/** `YYYY-MM-DD` ± whole days, done on the calendar (handles month/year ends). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + delta)).toISOString().slice(0, 10);
}

/**
 * Which group a notification belongs to. Compares calendar days, not 24 h
 * windows — 23:50 yesterday is „Wczoraj” even 40 minutes later.
 */
export function dayBucket(at: string | Date, now: string | Date, tz = INBOX_TZ): DayBucket {
  const today = calendarDay(now, tz);
  const day = calendarDay(at, tz);
  if (day >= today) return "today";
  if (day === shiftDay(today, -1)) return "yesterday";
  return "earlier";
}

const time = (at: string | Date, tz: string) =>
  fmt(`t:${tz}`, () =>
    new Intl.DateTimeFormat("pl-PL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  ).format(new Date(at));

const shortDate = (at: string | Date, tz: string) =>
  fmt(`s:${tz}`, () => new Intl.DateTimeFormat("pl-PL", { timeZone: tz, day: "numeric", month: "short" })).format(
    new Date(at),
  );

/** „11:42” dziś · „wczoraj 15:22” · „20 sie 09:00” wcześniej. */
export function whenLabel(at: string | Date, now: string | Date, tz = INBOX_TZ): string {
  const bucket = dayBucket(at, now, tz);
  if (bucket === "today") return time(at, tz);
  if (bucket === "yesterday") return `wczoraj ${time(at, tz)}`;
  return `${shortDate(at, tz)} ${time(at, tz)}`;
}

/** „minął wczoraj (25 sie)” / „25 sie 17:00” — used by the due-date line. */
export function dueLabel(at: string | Date, now: string | Date, tz = INBOX_TZ): string {
  const bucket = dayBucket(at, now, tz);
  if (bucket === "today") return `dziś ${time(at, tz)}`;
  if (bucket === "yesterday") return `wczoraj (${shortDate(at, tz)})`;
  return `${shortDate(at, tz)} ${time(at, tz)}`;
}

export const MENTION_TYPES = ["comment.mention"];
export const ASSIGNMENT_TYPES = ["task.assigned", "support.assigned"];

export function filterByTab<T extends { type: string; unread: boolean }>(items: T[], tab: InboxTab): T[] {
  switch (tab) {
    case "unread":
      return items.filter((i) => i.unread);
    case "mentions":
      return items.filter((i) => MENTION_TYPES.includes(i.type));
    case "assignments":
      return items.filter((i) => ASSIGNMENT_TYPES.includes(i.type));
    case "all":
      return items;
  }
}

const ORDER: DayBucket[] = ["today", "yesterday", "earlier"];

/** Ordered Dzisiaj → Wczoraj → Wcześniej; empty groups are dropped. */
export function groupByBucket<T extends { bucket: DayBucket }>(
  items: T[],
): { key: DayBucket; label: string; items: T[] }[] {
  return ORDER.map((key) => ({ key, label: BUCKET_LABEL[key], items: items.filter((i) => i.bucket === key) })).filter(
    (g) => g.items.length > 0,
  );
}
