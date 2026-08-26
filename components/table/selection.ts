// Row selection with Shift-range support, kept pure so it stays testable —
// the anchor (`from`) must be read before the caller moves it, because React
// runs state updaters lazily.
export function nextSelection(
  prev: Record<string, boolean>,
  ids: string[],
  id: string,
  from: string | null,
  shift: boolean,
): Record<string, boolean> {
  const next = { ...prev };
  if (shift && from && from !== id) {
    const a = ids.indexOf(from), b = ids.indexOf(id);
    if (a >= 0 && b >= 0) {
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next[ids[i]!] = true;
      return next;
    }
  }
  next[id] = !next[id];
  return next;
}
