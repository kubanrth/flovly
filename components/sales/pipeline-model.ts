// E7 „Plan sprzedaży" — czysta logika pipeline'u: granice kwartału, sumy per
// etap i polskie skrócone kwoty („186 tys. zł"). Bez Reacta, żeby dało się
// odpalić `npx tsx components/sales/pipeline-model.check.ts`.

export type ClosedKind = "won" | "lost" | null;

export interface StageLite {
  id: string;
  name: string;
  colorHex: string;
  order: number;
  closedKind: ClosedKind;
}

export interface DealLite {
  id: string;
  stageId: string;
  valueAmount: number | null;
  valueCurrency: string;
  // Data zamknięcia dealu w rozumieniu kafla „Wygrane Q<n>": expectedCloseAt,
  // a gdy pusty — updatedAt. Schemat nie ma closedAt (D7), patrz OMITTED.md.
  closedAt: string | null;
}

export interface Quarter {
  label: string;
  start: Date;
  /** Wyłącznie — pierwszy moment następnego kwartału. */
  end: Date;
}

export function quarterOf(now: Date): Quarter {
  const q = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();
  return {
    label: `Q${q + 1} ${year}`,
    start: new Date(year, q * 3, 1),
    end: new Date(year, q * 3 + 3, 1),
  };
}

export function sumByCurrency(deals: DealLite[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of deals) {
    if (d.valueAmount == null) continue;
    out[d.valueCurrency] = (out[d.valueCurrency] ?? 0) + d.valueAmount;
  }
  return out;
}

const PL = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

/** „24 tys. zł", „1,2 mln zł", „850 zł". PLN renderuje się jako „zł". */
export function formatAmount(value: number, currency: string): string {
  const unit = currency === "PLN" ? "zł" : currency;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${PL.format(value / 1_000_000)} mln ${unit}`;
  if (abs >= 1_000) return `${PL.format(value / 1_000)} tys. ${unit}`;
  return `${PL.format(value)} ${unit}`;
}

/** Kilka walut naraz — łączone kropką środkową; brak kwot → „—". */
export function formatSums(sums: Record<string, number>): string {
  const parts = Object.entries(sums)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, sum]) => formatAmount(sum, cur));
  return parts.length === 0 ? "—" : parts.join(" · ");
}

export function isWonStage(stage: StageLite | undefined): boolean {
  return stage?.closedKind === "won";
}

/** Deale w etapach otwartych (bez „wygrane"/„przegrane") — kafel „W pipeline". */
export function openDeals(deals: DealLite[], stageById: Map<string, StageLite>): DealLite[] {
  return deals.filter((d) => (stageById.get(d.stageId)?.closedKind ?? null) === null);
}

/** Wygrane z bieżącego kwartału — kafel „Wygrane Q<n>". */
export function wonInQuarter(
  deals: DealLite[],
  stageById: Map<string, StageLite>,
  q: Quarter,
): DealLite[] {
  return deals.filter((d) => {
    if (!isWonStage(stageById.get(d.stageId))) return false;
    if (!d.closedAt) return false;
    const t = new Date(d.closedAt).getTime();
    return t >= q.start.getTime() && t < q.end.getTime();
  });
}
