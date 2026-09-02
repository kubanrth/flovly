// Przestawianie kolumn Tablicy — czysta czesc, zeby dalo sie ja sprawdzic bez
// przegladarki (samo przeciaganie zalezy od animacji dnd-kit i nie jest
// powtarzalne w tescie e2e).
//
// `NO_STATUS` to kolumna wirtualna: nie ma wiersza w bazie, wiec nie da sie jej
// przestawic ani upuscic na nia innej kolumny.

import { NO_STATUS } from "./kanban-model";

export const COL_DRAG_PREFIX = "colsort:";

export const isColumnDragId = (id: string) => id.startsWith(COL_DRAG_PREFIX);
export const columnIdFromDragId = (id: string) => id.slice(COL_DRAG_PREFIX.length);

/**
 * Kolumna, do ktorej prowadzi punkt upuszczenia. Kursor moze byc nad naglowkiem
 * kolumny (`colsort:`), nad jej obszarem (`col:`) albo nad karta — wszystkie
 * trzy przypadki wskazuja te sama kolumne.
 */
export function columnOfDropTarget(
  overId: string,
  taskColumn: (taskId: string) => string | null,
): string | null {
  if (isColumnDragId(overId)) return columnIdFromDragId(overId);
  if (overId.startsWith("col:")) return overId.slice(4);
  return taskColumn(overId);
}

/**
 * Nowa kolejnosc kolumn po upuszczeniu, albo `null` gdy nic sie nie zmienia.
 * Zwracana tablica to komplet kolumn tablicy — dokladnie w tej kolejnosci
 * zapisuje je `reorderStatusColumnsAction`.
 */
export function nextColumnOrder<T extends { id: string }>(
  columns: T[],
  activeColumnId: string,
  overColumnId: string | null,
): T[] | null {
  if (!overColumnId || overColumnId === NO_STATUS || activeColumnId === NO_STATUS) return null;
  if (activeColumnId === overColumnId) return null;
  const from = columns.findIndex((c) => c.id === activeColumnId);
  const to = columns.findIndex((c) => c.id === overColumnId);
  if (from < 0 || to < 0) return null;
  const next = [...columns];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
