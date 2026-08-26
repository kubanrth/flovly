// Pure helpers for TO DO (D3): sekcje Dzisiaj / Ten tydzień / Później,
// „Ukończone wcześniej” i licznik „N/M dziś”.
// Self-check: `npx tsx components/my/todo/todo-buckets.check.ts`.

export type TodoSection = "today" | "week" | "later";

export interface TodoBucketable {
  completed: boolean;
  dueDate: string | null;
  /** Proxy „ukończone dziś” — schemat nie ma completedAt. */
  updatedAt: string;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Poniedziałek 00:00 następnego tygodnia — koniec sekcji „Ten tydzień”. */
export function startOfNextWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  const s = startOfDay(d);
  s.setDate(s.getDate() + (7 - day));
  return s;
}

export function completedToday(item: TodoBucketable, now: Date): boolean {
  if (!item.completed) return false;
  return new Date(item.updatedAt).getTime() >= startOfDay(now).getTime();
}

/** Bez terminu i po terminie = dzisiejsza robota (jak w makiecie D3). */
export function itemSection(item: TodoBucketable, now: Date): TodoSection {
  if (!item.dueDate) return "today";
  const t = new Date(item.dueDate).getTime();
  if (Number.isNaN(t)) return "today";
  const endOfToday = startOfDay(now).getTime() + 86_400_000;
  if (t < endOfToday) return "today";
  if (t < startOfNextWeek(now).getTime()) return "week";
  return "later";
}

export interface TodoBuckets<T extends TodoBucketable> {
  today: T[];
  week: T[];
  later: T[];
  /** Ukończone przed dzisiaj — zwinięte pod „Ukończone wcześniej · N”. */
  earlier: T[];
}

export function bucketItems<T extends TodoBucketable>(items: T[], now: Date): TodoBuckets<T> {
  const out: TodoBuckets<T> = { today: [], week: [], later: [], earlier: [] };
  for (const item of items) {
    if (item.completed && !completedToday(item, now)) out.earlier.push(item);
    else out[itemSection(item, now)].push(item);
  }
  return out;
}

/** „3/8 dziś” — ukończone dziś / wszystkie widoczne pozycje (bez „wcześniej”). */
export function dayCounter<T extends TodoBucketable>(b: TodoBuckets<T>, now: Date): { done: number; total: number } {
  const visible = [...b.today, ...b.week, ...b.later];
  return { done: visible.filter((i) => completedToday(i, now)).length, total: visible.length };
}

/** „pt” / „dziś” — etykieta terminu przy pozycji. */
export function dueLabel(dueDate: string, now: Date): string {
  const d = new Date(dueDate);
  const start = startOfDay(now).getTime();
  if (d.getTime() < start) return "po terminie";
  if (d.getTime() < start + 86_400_000) return "dziś";
  if (d.getTime() < startOfNextWeek(now).getTime()) {
    return d.toLocaleDateString("pl-PL", { weekday: "short" }).replace(/\.$/, "");
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
