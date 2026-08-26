import { makeIsDone } from "@/components/board/done-status";
// Pure aggregation for Podsumowanie (B8). Everything here is derived from
// data the schema already has (Task, StatusColumn, Milestone, membership) —
// no budget, no WIP limits, no completion timestamps.
// Self-check: `npx tsx components/summary/aggregate.check.ts`.

export interface SummaryStatus {
  id: string;
  name: string;
  colorHex: string;
  order: number;
}

export interface SummaryTask {
  id: string;
  displayId: number;
  statusColumnId: string | null;
  stopAt: string | null;
  assigneeIds: string[];
}

export interface SummaryMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface SummaryMilestoneInput {
  id: string;
  title: string;
  stopAt: string;
  taskStatusIds: (string | null)[];
}

export interface SummaryInput {
  tasks: SummaryTask[];
  statuses: SummaryStatus[];
  members: SummaryMember[];
  milestones: SummaryMilestoneInput[];
  now: Date;
}

export interface StatusSlice {
  id: string;
  name: string;
  colorHex: string;
  count: number;
  /** Rounded percentage for the legend („N · %”). */
  pct: number;
  /** Exact fraction 0–1 for the segmented bar width. */
  share: number;
}

export interface WorkloadRow extends SummaryMember {
  /** Open (= not done) tasks assigned to this person. */
  count: number;
  share: number;
}

export interface MilestoneRow {
  id: string;
  title: string;
  stopAt: string;
  total: number;
  done: number;
  share: number;
  /** Deadline passed and not every task is finished. */
  late: boolean;
}

export interface Summary {
  total: number;
  done: number;
  inProgress: number;
  overdue: { id: string; displayId: number }[];
  statuses: StatusSlice[];
  workload: WorkloadRow[];
  milestones: MilestoneRow[];
}

const PROGRESS_NAME = /^(w toku|w trakcie|in progress|doing|realizacja)$/i;

const NO_STATUS = "_empty";

/** `statusColumnId → is the task finished`. Shared rule, see `components/board/done-status.ts`. */
export { makeIsDone };

/**
 * „W toku” = tasks sitting in a column named like work-in-progress. Boards
 * without such a column fall back to „has a status, not the first column,
 * not done” — the schema has no per-column semantics to lean on.
 */
function makeIsInProgress(
  statuses: SummaryStatus[],
  isDone: (id: string | null) => boolean,
): (statusColumnId: string | null) => boolean {
  const sorted = [...statuses].sort((a, b) => a.order - b.order);
  const named = new Set(sorted.filter((s) => PROGRESS_NAME.test(s.name.trim())).map((s) => s.id));
  const first = sorted[0] ?? null;
  return (statusColumnId) => {
    if (!statusColumnId || isDone(statusColumnId)) return false;
    if (named.size > 0) return named.has(statusColumnId);
    return first ? statusColumnId !== first.id : false;
  };
}

export function summarize({ tasks, statuses, members, milestones, now }: SummaryInput): Summary {
  const isDone = makeIsDone(statuses);
  const isInProgress = makeIsInProgress(statuses, isDone);
  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);
  const total = tasks.length;

  const counts = new Map<string, number>();
  let done = 0;
  let inProgress = 0;
  const overdue: { id: string; displayId: number }[] = [];
  const perPerson = new Map<string, number>();

  for (const t of tasks) {
    const key = t.statusColumnId ?? NO_STATUS;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const finished = isDone(t.statusColumnId);
    if (finished) done += 1;
    else {
      if (isInProgress(t.statusColumnId)) inProgress += 1;
      if (t.stopAt && new Date(t.stopAt).getTime() < now.getTime()) {
        overdue.push({ id: t.id, displayId: t.displayId });
      }
      for (const userId of t.assigneeIds) perPerson.set(userId, (perPerson.get(userId) ?? 0) + 1);
    }
  }

  const slice = (id: string, name: string, colorHex: string): StatusSlice => {
    const count = counts.get(id) ?? 0;
    return { id, name, colorHex, count, pct: total ? Math.round((count / total) * 100) : 0, share: total ? count / total : 0 };
  };
  const slices = sortedStatuses.map((s) => slice(s.id, s.name, s.colorHex));
  if ((counts.get(NO_STATUS) ?? 0) > 0) slices.push(slice(NO_STATUS, "Bez statusu", ""));

  const workloadCounts = members.map((m) => ({ ...m, count: perPerson.get(m.id) ?? 0 }));
  const maxLoad = workloadCounts.reduce((max, r) => Math.max(max, r.count), 0);
  const workload = workloadCounts
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"))
    .map((r) => ({ ...r, share: maxLoad ? r.count / maxLoad : 0 }));

  const milestoneRows = milestones.map((m) => {
    const doneCount = m.taskStatusIds.filter((id) => isDone(id)).length;
    const t = m.taskStatusIds.length;
    const share = t ? doneCount / t : 0;
    return { id: m.id, title: m.title, stopAt: m.stopAt, total: t, done: doneCount, share, late: share < 1 && new Date(m.stopAt).getTime() < now.getTime() };
  });

  // Overdue tile lists task IDs newest-first, like the mockup („#256 · #245”).
  overdue.sort((a, b) => b.displayId - a.displayId);

  return { total, done, inProgress, overdue, statuses: slices, workload, milestones: milestoneRows };
}

// ── Ostatnia aktywność ──────────────────────────────────────────────────────

const ACTIVITY_PHRASE: Record<string, string> = {
  "comment.created": "skomentował(a)",
  "comment.updated": "poprawił(a) komentarz w",
  "comment.deleted": "usunął(-ęła) komentarz w",
  "task.created": "utworzył(a)",
  "task.createdFromCanvas": "utworzył(a) z whiteboardu",
  "task.bulkImport": "zaimportował(a) zadania",
  "task.updated": "zaktualizował(a)",
  "task.patched": "zaktualizował(a)",
  "task.descriptionUpdated": "zaktualizował(a) opis",
  "task.moved": "przeniósł(-osła)",
  "task.bulkStatusChanged": "zmienił(a) status zadań",
  "task.priority": "zmienił(a) priorytet",
  "task.bulkPriority": "zmienił(a) priorytet zadań",
  "task.deleted": "usunął(-ęła) zadanie",
  "task.bulkDeleted": "usunął(-ęła) zadania",
  "task.emailSent": "wysłał(a) mailem",
  "task.recurrenceUpdated": "zmienił(a) cykliczność",
  "task.timerStarted": "uruchomił(a) timer w",
  "task.timerPaused": "zatrzymał(a) timer w",
  "task.timerCompleted": "zakończył(a) timer w",
  "timeEntry.created": "dodał(a) wpis czasu do",
  "attachment.created": "dodał(a) załącznik do",
  "attachment.deleted": "usunął(-ęła) załącznik z",
  "subtask.created": "dodał(a) podzadanie w",
  "subtask.deleted": "usunął(-ęła) podzadanie w",
  "taskLink.created": "powiązał(a)",
  "taskLink.deleted": "usunął(-ęła) powiązanie w",
  "poll.created": "utworzył(a) głosowanie w",
  "poll.closed": "zamknął(-ęła) głosowanie w",
  "milestone.created": "utworzył(a) milestone",
  "milestone.updated": "zaktualizował(a) milestone",
  "milestone.deleted": "usunął(-ęła) milestone",
  "milestone.linked": "połączył(a) milestone'y",
  "milestone.unlinked": "rozłączył(a) milestone'y",
  "board.overview.updated": "zaktualizował(a) opis tablicy",
  "board.renamed": "zmienił(a) nazwę tablicy",
  "board.statusColumnCreated": "dodał(a) kolumnę statusu",
  "board.statusColumnUpdated": "zmienił(a) kolumnę statusu",
  "board.statusColumnDeleted": "usunął(-ęła) kolumnę statusu",
  "board.backgroundCustomized": "zmienił(a) tło tablicy",
  "board.memberAdded": "dodał(a) osobę do tablicy",
  "board.memberRemoved": "usunął(-ęła) osobę z tablicy",
  "board.shareCreated": "udostępnił(a) tablicę",
  "board.shareRevoked": "cofnął(-ęła) udostępnienie",
  "boardView.created": "utworzył(a) widok",
  "boardView.deleted": "usunął(-ęła) widok",
};

/** Audit action → Polish verb phrase. Unknown actions fall back to the raw key. */
export function activityPhrase(action: string): string {
  const known = ACTIVITY_PHRASE[action];
  if (known) return known;
  if (action.startsWith("taskline.")) return "zmienił(a) linię zadań";
  if (action.startsWith("tableColumn.")) return "zmienił(a) kolumny listy";
  return action;
}

/** „14:32” today · „wczoraj” · „pon” inside the last week · „26 sie” beyond. */
export function activityTime(at: Date, now: Date): string {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(at)) / 86_400_000);
  if (days <= 0) return at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "wczoraj";
  if (days < 7) return at.toLocaleDateString("pl-PL", { weekday: "short" });
  return at.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
