"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type {
  PipelineDeal,
  PipelineStage,
} from "@/components/sales/sales-pipeline";

/**
 * B6 CRM mobile · Pipeline single-stage swipe view
 *
 * Zamiast wszystkich stage'y obok siebie (desktop chevron flow) — pokazujemy
 * jeden stage na raz, swipe left/right zmienia stage. Czytelnie wskazuje gdzie
 * jesteśmy:
 * - sticky header z chevron-left / stage name + dot / count + chevron-right
 * - wartość PLN total dla tego stage'a (mono, green-emerald)
 * - dot indicator bar pod listą (jak Instagram stories)
 *
 * Swipe gestures: natywne touchstart/touchmove/touchend, threshold = 60px lub
 * velocity > 0.4 px/ms. NIE używamy framer-motion / use-gesture — package.json
 * nie ma żadnego z nich, a 60-linijkowy native handler robi robotę.
 *
 * Mobile-only render: rodzic SalesPipeline ustawia max-md:hidden na desktop
 * column flow + md:hidden na ten komponent.
 *
 * IMPORTANT: ten komponent NIE robi DnD — na mobile drag-between-columns jest
 * niemożliwy bez kanwy. Zmiana stage'a deala = wejście w kartę deala. Spec to
 * potwierdza ("Zmień stage" jako action button w deal card mobile).
 */
export function SalesPipelineMobile({
  workspaceId,
  stages,
  deals,
}: {
  workspaceId: string;
  stages: PipelineStage[];
  deals: PipelineDeal[];
}) {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const [rawIdx, setIdx] = useState(0);

  // Clamp derived — unika setState w effect'cie (cascading renders) gdy
  // stage'e znikną/dodadzą się między render'ami.
  const idx = Math.min(rawIdx, Math.max(0, sortedStages.length - 1));
  const stage = sortedStages[idx];

  // Refs do swipe state — unikamy re-render'a na każdym touchmove.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartT = useRef<number>(0);
  const swipedRef = useRef(false);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(sortedStages.length - 1, i + 1));

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchStartT.current = performance.now();
    swipedRef.current = false;
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    if (swipedRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    // Jeśli vertical scroll dominuje, ignorujemy — user scrolluje listę,
    // nie swipuje stage'a.
    if (Math.abs(dy) > Math.abs(dx)) return;
    const dt = performance.now() - touchStartT.current;
    const velocity = Math.abs(dx) / Math.max(1, dt);
    if (Math.abs(dx) > 60 || velocity > 0.4) {
      if (dx < 0) goNext();
      else goPrev();
      swipedRef.current = true;
    }
  };

  const onTouchEnd = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    swipedRef.current = false;
  };

  if (!stage) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-12 text-center text-[0.88rem] text-muted-foreground md:hidden">
        Brak etapów.
      </p>
    );
  }

  const stageDeals = deals
    .filter((d) => d.stageId === stage.id)
    .sort((a, b) => a.rowOrder - b.rowOrder);

  // Suma per waluta (PLN/EUR/USD). Empty state nie pokazuje pill'a.
  const totals = new Map<string, number>();
  for (const d of stageDeals) {
    if (d.valueAmount == null) continue;
    totals.set(
      d.valueCurrency,
      (totals.get(d.valueCurrency) ?? 0) + d.valueAmount,
    );
  }

  const canPrev = idx > 0;
  const canNext = idx < sortedStages.length - 1;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {/* Stage header z chevronami i count'em. Tap'alne chevron'y dla użytkow-
          ników którzy wolą nie swipać. */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2 py-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Poprzedni etap"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: stage.colorHex }}
              aria-hidden
            />
            <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
              {stage.name}
            </span>
            <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
              {stageDeals.length}
            </span>
          </div>
          {totals.size > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-[0.7rem] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {[...totals.entries()].map(([cur, sum]) => (
                <span key={cur}>{formatMoney(sum, cur)}</span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Następny etap"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Swipe target: cards stack. touch-pan-y żeby vertical scroll dalej
          działał, ale horizontal swipe wchodzi w nasz handler. */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex min-h-[200px] touch-pan-y flex-col gap-2"
      >
        {stageDeals.length === 0 && (
          <div className="grid place-items-center rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-[0.82rem] text-muted-foreground">
            <span>Brak deal&apos;ów na tym etapie.</span>
            <Link
              href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.82rem] font-semibold text-white shadow-brand"
            >
              <Plus size={13} /> Dodaj deal
            </Link>
          </div>
        )}
        {stageDeals.map((d) => (
          <Link
            key={d.id}
            href={`/w/${workspaceId}/sales/${d.id}`}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 transition-colors active:bg-accent/40"
          >
            <span className="font-display text-[0.94rem] font-semibold leading-tight">
              {d.title}
            </span>
            <span className="font-mono text-[1.05rem] font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">
              {d.valueAmount != null
                ? formatMoney(d.valueAmount, d.valueCurrency)
                : "—"}
            </span>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                {d.expectedCloseAt
                  ? `do ${new Date(d.expectedCloseAt).toLocaleDateString("pl-PL")}`
                  : (d.contact?.companyName ?? d.contact?.name ?? "—")}
              </span>
              {d.owner && (
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-brand-gradient font-display text-[0.55rem] font-bold text-white"
                  aria-label={d.owner.name ?? d.owner.email}
                >
                  {d.owner.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.owner.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (d.owner.name ?? d.owner.email).slice(0, 2).toUpperCase()
                  )}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Stage dots — current = wider pill, reszta = 6px circle. */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {sortedStages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Przejdź do etapu ${s.name}`}
            aria-current={i === idx ? "true" : undefined}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 18 : 6,
              height: 6,
              background:
                i === idx ? "var(--primary)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const PL_NUMBER = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMoney(amount: number, currency: string): string {
  return `${PL_NUMBER.format(amount)} ${currency}`;
}
