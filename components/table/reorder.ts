// F16: ręczna kolejność na Liście (przeciąganie uchwytem w komórce #ID).
// Czysta logika, bez React. Self-check: `npx tsx components/table/reorder.check.ts`.
//
// Lista jest ułożona po statusie, a w statusie po `rowOrder`. Upuszczone
// zadanie przejmuje więc status wiersza, przy którym wylądowało, i dostaje
// `rowOrder` między sąsiadami z tego statusu — inaczej po odświeżeniu z serwera
// wróciłoby na stare miejsce.

export interface ReorderRow {
  id: string;
  parentId: string | null;
  statusColumnId: string | null;
  rowOrder: number;
}

export type DropEdge = "before" | "after";

export interface DropPlan {
  statusColumnId: string | null;
  rowOrder: number;
}

/**
 * `rows` = widoczne wiersze w kolejności z ekranu. `groupKeyOf` podaje się przy
 * grupowaniu po czymś innym niż status — wtedy ruch między grupami jest odrzucany,
 * bo lista nie zmienia tego pola (priorytetu, kategorii…) i wiersz by wrócił.
 * Zwraca null, gdy ruch nic nie zmienia albo nie ma sensu (na siebie, poza
 * rodzeństwo swojego rodzica).
 */
export function planDrop<T extends ReorderRow>(
  rows: readonly T[],
  activeId: string,
  overId: string,
  edge: DropEdge,
  groupKeyOf?: (id: string) => string | undefined,
): DropPlan | null {
  const ia = rows.findIndex((r) => r.id === activeId);
  const io = rows.findIndex((r) => r.id === overId);
  if (ia === -1 || io === -1 || ia === io) return null;
  const active = rows[ia]!;
  const over = rows[io]!;
  // Dziecko zostaje pod swoim rodzicem — Lista i tak by je tam wciągnęła.
  if (active.parentId !== over.parentId) return null;
  if (groupKeyOf && groupKeyOf(active.id) !== groupKeyOf(over.id)) return null;

  // Sąsiedzi liczą się wśród rodzeństwa: rodzic ani cudze dzieci nie wpływają
  // na kolejność w obrębie jednego rodzica.
  const siblings = rows.filter((r) => r.parentId === active.parentId);
  const was = siblings.findIndex((r) => r.id === activeId);
  const rest = siblings.filter((r) => r.id !== activeId);
  const p = rest.findIndex((r) => r.id === overId) + (edge === "after" ? 1 : 0);
  const prev = rest[p - 1] ?? null;
  const next = rest[p] ?? null;
  // Upuszczenie dokładnie tam, skąd wzięto — brak zmiany.
  if (prev?.id === siblings[was - 1]?.id && next?.id === siblings[was + 1]?.id) return null;

  const statusColumnId = over.statusColumnId;
  const prevSame = prev && prev.statusColumnId === statusColumnId ? prev : null;
  const nextSame = next && next.statusColumnId === statusColumnId ? next : null;
  const rowOrder =
    prevSame && nextSame ? (prevSame.rowOrder + nextSame.rowOrder) / 2
    : prevSame ? prevSame.rowOrder + 1
    : nextSame ? nextSame.rowOrder - 1
    : over.rowOrder;
  return { statusColumnId, rowOrder };
}

/**
 * Lokalne ułożenie po ruchu — ten sam klucz, co `orderBy` na serwerze
 * (kolejność statusu, potem `rowOrder`; bez statusu na końcu), z indeksem
 * wejściowym jako rozstrzygnięciem remisów, żeby nic poza przesuniętym
 * wierszem nie drgnęło.
 */
export function resortByStatus<T extends { statusColumnId: string | null; rowOrder: number }>(
  list: readonly T[],
  statusIndex: ReadonlyMap<string, number>,
): T[] {
  const key = (t: T) =>
    t.statusColumnId ? (statusIndex.get(t.statusColumnId) ?? Number.MAX_SAFE_INTEGER - 1) : Number.MAX_SAFE_INTEGER;
  return list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => key(a.t) - key(b.t) || a.t.rowOrder - b.t.rowOrder || a.i - b.i)
    .map((x) => x.t);
}
