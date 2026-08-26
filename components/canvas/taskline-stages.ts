// Czysta logika Linii zadań (B10): kolejność etapów, przypisanie kart do
// etapów, zwijanie starszych kart w ostatnim etapie, kolejność po
// przeciągnięciu i polska odmiana liczebników w stopce.
// Self-check: `npx tsx components/canvas/taskline-stages.check.ts`.

export interface TaskLineStage {
  id: string;
  name: string;
  order: number;
}

export interface TaskLineCard {
  /** ProcessNode id */
  id: string;
  taskId: string;
  taskTitle: string;
  displayId: number | null;
  statusName: string | null;
  statusColor: string | null;
  flowMark: "start" | "end" | null;
  /** Klucz sortowania w obrębie etapu. */
  x: number;
  /** TaskLineRow id — etap, w którym stoi karta. */
  lineId: string;
}

export interface TaskLineAssignee {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface TaskLineTask {
  id: string;
  title: string;
  displayId: number;
  statusName: string | null;
  statusColor: string | null;
  assignees: TaskLineAssignee[];
}

export type TaskLineMember = TaskLineAssignee;

/** Ile kart ostatniego etapu widać przed „Pokaż N starsze…" (B10). */
export const OLDER_VISIBLE = 2;

export function sortStages(stages: TaskLineStage[]): TaskLineStage[] {
  return [...stages].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function cardsByStage(
  cards: TaskLineCard[],
  stages: TaskLineStage[],
): Map<string, TaskLineCard[]> {
  const map = new Map<string, TaskLineCard[]>();
  for (const s of stages) map.set(s.id, []);
  for (const c of cards) map.get(c.lineId)?.push(c);
  for (const list of map.values()) list.sort((a, b) => a.x - b.x);
  return map;
}

export function bucketOlder<T>(
  cards: T[],
  expanded: boolean,
  visible: number = OLDER_VISIBLE,
): { shown: T[]; hidden: number } {
  if (expanded || cards.length <= visible) return { shown: cards, hidden: 0 };
  return { shown: cards.slice(0, visible), hidden: cards.length - visible };
}

/** Nowa kolejność id po upuszczeniu `dragged` przed `before` (null = koniec). */
export function reorderIds(
  ids: string[],
  dragged: string,
  before: string | null,
): string[] {
  const rest = ids.filter((i) => i !== dragged);
  if (before === null || before === dragged) return [...rest, dragged];
  const at = rest.indexOf(before);
  if (at === -1) return [...rest, dragged];
  return [...rest.slice(0, at), dragged, ...rest.slice(at)];
}

/** Polska odmiana: [1, 2–4, 5+] z wyjątkiem nastek. */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const teen = abs % 100;
  if (abs === 1) return `${n} ${forms[0]}`;
  if (last >= 2 && last <= 4 && (teen < 12 || teen > 14)) return `${n} ${forms[1]}`;
  return `${n} ${forms[2]}`;
}
