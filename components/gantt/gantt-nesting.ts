// F13: drzewo zadan w Osi czasu. Czysta logika, bez React.
// Self-check: `npx tsx components/gantt/gantt-nesting.check.ts`.

export interface Nestable { id: string; parentId: string | null }

/**
 * Korzenie = zadania bez rodzica ALBO takie, ktorych rodzica nie ma w zbiorze
 * (skasowany, odfiltrowany, inna tablica) — sierota nie moze zniknac z widoku.
 * `childrenOf` trzyma kolejnosc wejsciowa.
 */
export function nestTasks<T extends Nestable>(tasks: readonly T[]): { roots: T[]; childrenOf: Map<string, T[]> } {
  const ids = new Set(tasks.map((t) => t.id));
  const roots: T[] = [];
  const childrenOf = new Map<string, T[]>();
  for (const t of tasks) {
    if (t.parentId && ids.has(t.parentId)) {
      const bucket = childrenOf.get(t.parentId);
      if (bucket) bucket.push(t); else childrenOf.set(t.parentId, [t]);
    } else roots.push(t);
  }
  return { roots, childrenOf };
}

/** Splaszczenie z glebokoscia: rozwiniete rodzice wypuszczaja dzieci tuz pod soba. */
export function flattenTree<T extends Nestable>(
  roots: readonly T[], childrenOf: Map<string, T[]>, expanded: ReadonlySet<string>, depth = 0,
): { t: T; depth: number; childCount: number }[] {
  const out: { t: T; depth: number; childCount: number }[] = [];
  for (const t of roots) {
    const kids = childrenOf.get(t.id) ?? [];
    out.push({ t, depth, childCount: kids.length });
    if (kids.length && expanded.has(t.id)) out.push(...flattenTree(kids, childrenOf, expanded, depth + 1));
  }
  return out;
}
