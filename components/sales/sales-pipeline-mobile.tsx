"use client";

// E7 na wąskim ekranie — makieta pokrywa tylko desktop, więc zostaje wzorzec
// „jeden etap na raz": swipe / chevron przełącza etap, tap w kartę wchodzi
// w deal (drag&drop między kolumnami nie ma na mobile sensu).

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconChevronLeft, IconChevronRight, IconPlus } from "@/components/ui/icons";
import { formatAmount, isWonStage, sumByCurrency, formatSums } from "@/components/sales/pipeline-model";
import type { PipelineDeal, PipelineStage } from "@/components/sales/sales-screen";
import { cn } from "@/lib/utils";

export function SalesPipelineMobile({
  workspaceId,
  stages,
  deals,
}: {
  workspaceId: string;
  stages: PipelineStage[];
  deals: PipelineDeal[];
}) {
  const [rawIdx, setIdx] = useState(0);
  // Clamp pochodny — etapy mogą zniknąć między renderami.
  const idx = Math.min(rawIdx, Math.max(0, stages.length - 1));
  const stage = stages[idx];

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startT = useRef(0);
  const swiped = useRef(false);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(stages.length - 1, i + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    startT.current = performance.now();
    swiped.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null || swiped.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // Pionowy ruch = scroll listy, nie zmiana etapu.
    if (Math.abs(dy) > Math.abs(dx)) return;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - startT.current);
    if (Math.abs(dx) > 60 || velocity > 0.4) {
      if (dx < 0) goNext();
      else goPrev();
      swiped.current = true;
    }
  };
  const onTouchEnd = () => {
    startX.current = null;
    startY.current = null;
    swiped.current = false;
  };

  if (!stage) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground md:hidden">Brak etapów.</p>
    );
  }

  const stageDeals = deals.filter((d) => d.stageId === stage.id).sort((a, b) => a.rowOrder - b.rowOrder);
  const won = isWonStage(stage);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto bg-canvas px-4 pt-1 pb-5 md:hidden">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
        <Button variant="ghost" size="lg" iconOnly disabled={idx === 0} onClick={goPrev} aria-label="Poprzedni etap">
          <IconChevronLeft />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: stage.colorHex }} aria-hidden />
            <span className="truncate text-sm font-semibold">{stage.name}</span>
          </span>
          <span className="font-mono text-2xs text-fg-3">
            {stageDeals.length} · {formatSums(sumByCurrency(stageDeals))}
          </span>
        </div>
        <Button
          variant="ghost"
          size="lg"
          iconOnly
          disabled={idx >= stages.length - 1}
          onClick={goNext}
          aria-label="Następny etap"
        >
          <IconChevronRight />
        </Button>
      </div>

      <ul
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex touch-pan-y flex-col gap-2"
      >
        {stageDeals.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input-border px-4 py-8 text-center text-xs text-muted-foreground">
            Brak dealów na tym etapie.
            <Button size="lg" className="h-11" render={<Link href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`} />}>
              <IconPlus width={14} height={14} /> Dodaj deal
            </Button>
          </li>
        )}
        {stageDeals.map((d) => (
          <li key={d.id}>
            <Link
              href={`/w/${workspaceId}/sales/${d.id}`}
              className={cn(
                "block rounded-lg border border-border bg-card px-3 py-3 outline-none active:bg-n-100",
                won && "opacity-85",
              )}
            >
              <p className="mb-1.5 text-sm font-medium leading-[18px]">{d.title}</p>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-2xs text-n-700">
                  {d.valueAmount != null ? formatAmount(d.valueAmount, d.valueCurrency) : "—"}
                </span>
                {won && <Chip hue="green" dot size="sm">Wygrany</Chip>}
                {d.owner && (
                  <span className="ml-auto">
                    <Avatar name={d.owner.name} src={d.owner.avatarUrl} size={20} />
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate border-t border-n-100 pt-1.5 text-2xs text-fg-2">
                {d.expectedCloseAt
                  ? `zamknięcie ${new Date(d.expectedCloseAt).toLocaleDateString("pl-PL")}`
                  : (d.contact?.name ?? "—")}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-center gap-1">
        {stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Przejdź do etapu ${s.name}`}
            aria-current={i === idx ? "true" : undefined}
            className="grid h-6 w-6 place-items-center rounded-md outline-none active:bg-n-100"
          >
            <span
              className={cn("h-1.5 rounded-full", i === idx ? "w-4 bg-orange-500" : "w-1.5 bg-n-300")}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
