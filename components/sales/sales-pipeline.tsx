"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {sortedStages.map((stage) => {
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
            />
          );
        })}
      </div>
    </DndContext>
  );
}

function StageColumn({
  workspaceId,
  stage,
  deals,
  totals,
  activeId,
}: {
  workspaceId: string;
  stage: PipelineStage;
  deals: PipelineDeal[];
  totals: Record<string, number>;
  activeId: string | null;
}) {
  // Whole column is a drop target — "col:" prefix lets onDragOver/onDragEnd
  // distinguish empty-column drops from over-card drops.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}` });

  return (
    <div
      ref={setNodeRef}
      data-stage-id={stage.id}
      className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 transition-colors data-[over=true]:border-primary/60 data-[over=true]:bg-primary/5"
      data-over={isOver ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: stage.colorHex }}
            aria-hidden
          />
          <span className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
            {stage.name}
          </span>
          <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
            {deals.length}
          </span>
        </div>
        <Link
          href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`}
          aria-label={`Nowy deal w etapie ${stage.name}`}
          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          +
        </Link>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1 px-1 pb-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          {Object.entries(totals).map(([cur, sum]) => (
            <span key={cur} className="rounded-sm bg-muted/40 px-1.5 py-0.5">
              {formatMoney(sum, cur)}
            </span>
          ))}
        </div>
      )}

      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex min-h-[40px] flex-col gap-2">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              workspaceId={workspaceId}
              deal={d}
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
  dragging,
}: {
  workspaceId: string;
  deal: PipelineDeal;
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
        className="block rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-background"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 font-display text-[0.9rem] font-semibold leading-tight tracking-[-0.01em]">
            {deal.title}
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

        {deal.valueAmount != null && (
          <div className="mt-1.5 font-mono text-[0.74rem] font-semibold text-foreground">
            {formatMoney(deal.valueAmount, deal.valueCurrency)}
          </div>
        )}

        {deal.contact && (
          <div className="mt-1 truncate font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            {deal.contact.companyName ?? deal.contact.name}
          </div>
        )}
      </Link>
    </li>
  );
}
