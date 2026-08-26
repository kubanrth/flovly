// Which status column means „ukończone”.
//
// The schema has no `StatusColumn.isDone`, so this is a heuristic — and it used
// to live in four places that disagreed. Two rules, in order:
//   1. any column whose name reads as done → only those count,
//   2. no such column → the terminal column by `order` counts.
// Step 1 matters because boards routinely append columns after „Done”
// („Done”, „FAZA-2030”, „test”); the terminal-column rule alone both misses
// finished tasks and counts unfinished ones.
export const DONE_NAME =
  /^(done|zrobione|zrobiona|gotowe|gotowy|gotów|uko(ń|n)czone|zako(ń|n)czone|wykonane|zamkni(ę|e)te|closed|complete|completed)$/i;

export interface DoneColumn {
  id: string;
  name: string;
  order: number;
}

export function doneColumnIds(columns: DoneColumn[]): Set<string> {
  const named = columns.filter((c) => DONE_NAME.test(c.name.trim()));
  if (named.length > 0) return new Set(named.map((c) => c.id));
  const last = [...columns].sort((a, b) => a.order - b.order).at(-1);
  return new Set(last ? [last.id] : []);
}

// Convenience for row-at-a-time callers; build the set once per board.
export function makeIsDone(columns: DoneColumn[]): (statusColumnId: string | null | undefined) => boolean {
  const ids = doneColumnIds(columns);
  return (statusColumnId) => !!statusColumnId && ids.has(statusColumnId);
}
