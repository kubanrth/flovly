"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { SalesPipelineMobile } from "@/components/sales/sales-pipeline-mobile";

export interface PipelineStage {
  id: string;
  name: string;
  colorHex: string;
  order: number;
  closedKind: "won" | "lost" | null;
}

export interface PipelineDeal {
  id: string;
  stageId: string;
  rowOrder: number;
  title: string;
  valueAmount: number | null;
  valueCurrency: string;
  expectedCloseAt: string | null;
  contact: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

// Polish locale number formatting — group with non-breaking space, comma decimal.
const PL_NUMBER = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMoney(amount: number, currency: string): string {
  return `${PL_NUMBER.format(amount)} ${currency}`;
}

export function SalesPipeline({
  workspaceId,
  stages,
  initialDeals,
}: {
  workspaceId: string;
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
}) {
  const router = useRouter();
  const [deals, setDeals] = useState<PipelineDeal[]>(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startPatch] = useTransition();

  // Replay server state when the user navigates back or revalidate fires —
  // otherwise an aborted drag leaves the optimistic state out of sync.
  useEffect(() => {
    setDeals(initialDeals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeals.map((d) => `${d.id}:${d.stageId}:${d.rowOrder}`).join(",")]);

  // Same input split as kanban — mouse activates after a tiny drag, touch
  // needs a brief press so the column isn't grabbed instead of scrolled.
  // Single PointerSensor previously conflated both inputs and made the
  // pipeline feel "stuck" when trying to move a deal between stages.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Hybrid collision: pointerWithin gives precise per-card targeting inside
  // a column; rectIntersection catches drops on the empty column gaps.
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  };

  // Group deals by stage, sorted by rowOrder. Done in render — fast for the
  // ~hundreds-of-deals scale we expect; no memo bookkeeping needed.
  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of deals) {
      const arr = map.get(d.stageId);
      if (arr) arr.push(d);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.rowOrder - b.rowOrder);
    return map;
  }, [stages, deals]);

  // Sum per stage, broken out by currency so PLN deals don't pollute EUR totals.
  const totalsByStage = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const s of stages) m.set(s.id, {});
    for (const d of deals) {
      if (d.valueAmount == null) continue;
      const t = m.get(d.stageId);
      if (!t) continue;
      t[d.valueCurrency] = (t[d.valueCurrency] ?? 0) + d.valueAmount;
    }
    return m;
  }, [stages, deals]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Optimistic intra/inter-column move while the user drags so columns reflow live.
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeDeal = deals.find((d) => d.id === activeId);
    if (!activeDeal) return;

    let targetStageId: string;
    if (overId.startsWith("col:")) targetStageId = overId.slice(4);
    else {
      const over = deals.find((d) => d.id === overId);
      if (!over) return;
      targetStageId = over.stageId;
    }
    if (activeDeal.stageId === targetStageId) return;
    setDeals((prev) =>
      prev.map((d) => (d.id === activeId ? { ...d, stageId: targetStageId } : d)),
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeDeal = deals.find((d) => d.id === activeId);
    if (!activeDeal) return;

    let targetStageId: string;
    let targetIndex: number;
    if (overId.startsWith("col:")) {
      targetStageId = overId.slice(4);
      targetIndex = (dealsByStage.get(targetStageId) ?? []).length;
    } else {
      const overDeal = deals.find((d) => d.id === overId);
      if (!overDeal) return;
      targetStageId = overDeal.stageId;
      const col = dealsByStage.get(targetStageId) ?? [];
      const curIx = col.findIndex((d) => d.id === activeId);
      const overIx = col.findIndex((d) => d.id === overId);
      targetIndex = curIx === -1 ? overIx + 1 : overIx;
    }

    const colDeals = dealsByStage.get(targetStageId) ?? [];
    const without = colDeals.filter((d) => d.id !== activeId);
    const prev = targetIndex > 0 ? without[targetIndex - 1] : null;
    const next = targetIndex < without.length ? without[targetIndex] : null;
    const newRowOrder =
      prev && next
        ? (prev.rowOrder + next.rowOrder) / 2
        : prev
          ? prev.rowOrder + 1
          : next
            ? next.rowOrder / 2
            : 1;

    if (
      activeDeal.stageId === targetStageId &&
      activeDeal.rowOrder === newRowOrder
    ) {
      return;
    }

    setDeals((prevState) =>
      prevState.map((d) =>
        d.id === activeId ? { ...d, stageId: targetStageId, rowOrder: newRowOrder } : d,
      ),
    );

    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("dealId", activeId);
    fd.set("stageId", targetStageId);
    fd.set("rowOrder", String(newRowOrder));
    startPatch(() => {
      void moveDealAction(fd).then(() => router.refresh());
    });
  };

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  return (
    <>
      {/* Mobile (B6 spec): single-stage swipe view — jeden etap na raz,
          swipe / chevron przełącza. DnD nie ma sensu na mobile (kolumny nie
          mieszczą się obok siebie), więc nawigacja po stage'ach + tap na
          dealu → karta → "Zmień stage". */}
      <SalesPipelineMobile
        workspaceId={workspaceId}
        stages={stages}
        deals={deals}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        // Re-measure droppable rects on every layout change — columns reflow
        // when deals enter/leave so stale rects caused drops to miss the new
        // target column.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Desktop: oryginalny horizontal flex z chevron headerami. Mobile
            wyłączony (max-md:hidden) — zastąpiony przez SalesPipelineMobile
            powyżej. */}
        <div className="flex gap-1 pb-4 max-md:hidden md:overflow-x-auto">
          {sortedStages.map((stage, idx) => {
            const colDeals = dealsByStage.get(stage.id) ?? [];
            const totals = totalsByStage.get(stage.id) ?? {};
            return (
              <StageColumn
                key={stage.id}
                workspaceId={workspaceId}
                stage={stage}
                deals={colDeals}
                totals={totals}
                activeId={activeId}
                isFirst={idx === 0}
                isLast={idx === sortedStages.length - 1}
              />
            );
          })}
        </div>
      </DndContext>
    </>
  );
}

// Picks a readable foreground color for an arbitrary bg hex. Cheap luminance
// check — keeps the stage chevron readable whether the user picked a pastel or
// a deep saturated color.
function readableOn(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#fff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Rec. 709 luma. Threshold 150 leaves room for "soft" colors to still feel
  // light without flipping to dark text too aggressively.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 150 ? "#0F172A" : "#fff";
}

// Chevron clip-path per position. Notch depth is fixed so columns slot together
// visually regardless of width.
const CHEVRON_NOTCH = 12;
function chevronClipPath(isFirst: boolean, isLast: boolean): string {
  const n = CHEVRON_NOTCH;
  if (isFirst && isLast) {
    // Single-column pipeline — no chevron, just a rounded pill (handled via CSS).
    return "none";
  }
  if (isFirst) {
    return `polygon(0% 0%, calc(100% - ${n}px) 0%, 100% 50%, calc(100% - ${n}px) 100%, 0% 100%)`;
  }
  if (isLast) {
    return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${n}px 50%)`;
  }
  return `polygon(0% 0%, calc(100% - ${n}px) 0%, 100% 50%, calc(100% - ${n}px) 100%, 0% 100%, ${n}px 50%)`;
}

function StageColumn({
  workspaceId,
  stage,
  deals,
  totals,
  activeId,
  isFirst,
  isLast,
}: {
  workspaceId: string;
  stage: PipelineStage;
  deals: PipelineDeal[];
  totals: Record<string, number>;
  activeId: string | null;
  isFirst: boolean;
  isLast: boolean;
}) {
  // Whole column is a drop target — "col:" prefix lets onDragOver/onDragEnd
  // distinguish empty-column drops from over-card drops.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}` });

  const fg = readableOn(stage.colorHex);
  // Pad horizontally inside the chevron so text doesn't crash into the notches.
  // Asymmetric padding accounts for one or two notches per chevron.
  const headerLeftPad = isFirst ? 14 : CHEVRON_NOTCH + 8;
  const headerRightPad = isLast ? 14 : CHEVRON_NOTCH + 8;

  return (
    <div
      ref={setNodeRef}
      data-stage-id={stage.id}
      // max-md:w-full → full-width pojedyncza kolumna w stack'u; desktop
      // zostaje na fixed 280px żeby pipeline trzymał chevron design.
      className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl bg-card/40 pb-3 transition-colors data-[over=true]:bg-primary/5 max-md:w-full"
      data-over={isOver ? "true" : "false"}
    >
      {/* Desktop: chevron header (clip-path strzałka) ze sticky-top. Mobile:
          plain rounded-lg header — chevron clip + pełna szerokość = brzydki
          wycinek po prawej. Sticky też off na mobile bo każda kolumna jest
          w osobnym vertical slot'cie.
          Dwa render'y bo dynamic clip-path nie da się prosto override'ować
          z CSS class'y — łatwiej dwa div'y z visibility. */}
      <div className="hidden md:sticky md:top-0 md:z-[1] md:pointer-events-none md:block">
        <div
          className="flex h-10 items-center justify-between gap-2"
          style={{
            background: stage.colorHex,
            color: fg,
            clipPath: chevronClipPath(isFirst, isLast),
            paddingLeft: headerLeftPad,
            paddingRight: headerRightPad,
            borderRadius: isFirst && isLast ? 10 : 0,
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-[0.86rem] font-semibold tracking-[-0.01em]">
              {stage.name}
            </span>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold tabular-nums"
              style={{
                background:
                  fg === "#fff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
              }}
            >
              {deals.length}
            </span>
          </div>
          <Link
            href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`}
            aria-label={`Nowy deal w etapie ${stage.name}`}
            title={`Nowy deal w etapie ${stage.name}`}
            // Re-enable klik na "+" — header ma pointer-events-none żeby nie blokował drag'a.
            className="pointer-events-auto grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10"
            style={{ color: fg }}
          >
            <span className="text-base leading-none">+</span>
          </Link>
        </div>
      </div>

      {/* Mobile header — plain rounded full-width pill, bez chevron clip-path'a.
          Full color background z stage.colorHex + "+" po prawej. */}
      <div
        className="flex h-11 items-center justify-between gap-2 rounded-lg px-3 md:hidden"
        style={{ background: stage.colorHex, color: fg }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
            {stage.name}
          </span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold tabular-nums"
            style={{
              background:
                fg === "#fff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
            }}
          >
            {deals.length}
          </span>
        </div>
        <Link
          href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`}
          aria-label={`Nowy deal w etapie ${stage.name}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10"
          style={{ color: fg }}
        >
          <span className="text-lg leading-none">+</span>
        </Link>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          {Object.entries(totals).map(([cur, sum]) => (
            <span
              key={cur}
              className="rounded-sm border border-border bg-card px-1.5 py-0.5"
            >
              {formatMoney(sum, cur)}
            </span>
          ))}
        </div>
      )}

      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex min-h-[40px] flex-col gap-2 px-3">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              workspaceId={workspaceId}
              deal={d}
              stage={stage}
              dragging={activeId === d.id}
            />
          ))}
          {deals.length === 0 && (
            <li className="grid h-16 place-items-center rounded-md border border-dashed border-border/60 text-[0.7rem] text-muted-foreground/60">
              Brak deal&apos;ów
            </li>
          )}
        </ul>
      </SortableContext>
    </div>
  );
}

function DealCard({
  workspaceId,
  deal,
  stage,
  dragging,
}: {
  workspaceId: string;
  deal: PipelineDeal;
  stage: PipelineStage;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: dragging || isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        href={`/w/${workspaceId}/sales/${deal.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="block overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary/40 hover:bg-background"
      >
        <div className="flex flex-col gap-1 p-3">
          {/* Value first — Livespace-style emphasis. Falls back to em-dash so
              row height stays consistent across cards with/without value. */}
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[0.9rem] font-bold tabular-nums leading-tight">
              {deal.valueAmount != null
                ? formatMoney(deal.valueAmount, deal.valueCurrency)
                : "—"}
            </span>
            {deal.owner && (
              <span
                title={deal.owner.name ?? deal.owner.email}
                className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.55rem] font-bold text-white"
              >
                {deal.owner.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={deal.owner.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (deal.owner.name ?? deal.owner.email).slice(0, 2).toUpperCase()
                )}
              </span>
            )}
          </div>

          <span className="line-clamp-2 font-display text-[0.84rem] font-medium leading-tight text-muted-foreground">
            {deal.title}
          </span>

          {deal.contact && (
            <div className="mt-0.5 truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">
              {deal.contact.companyName ?? deal.contact.name}
            </div>
          )}
        </div>

        {/* Stage-tinted accent strip — visual echo of the chevron above, makes
            cards readable as "belonging to" their column even without color in
            the card body. */}
        <div
          className="h-[3px] w-full"
          style={{ background: stage.colorHex }}
          aria-hidden
        />
      </Link>
    </li>
  );
}
