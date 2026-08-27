"use client";

// E7 „Plan sprzedaży" — nagłówek + 3 kafle + kolumny etapów 264px + stopka.
// Bez „% szansy" i bez kafla „Cel Q3" (OMITTED.md / MAP D7). Przeciąganie kart
// między etapami leci przez istniejące `moveDealAction`.

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
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
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconCalendar, IconContacts, IconPlus, IconReminders, IconWarning } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { SalesPipelineMobile } from "@/components/sales/sales-pipeline-mobile";
import {
  formatAmount,
  formatSums,
  isWonStage,
  openDeals,
  quarterOf,
  sumByCurrency,
  wonInQuarter,
  type ClosedKind,
  type DealLite,
} from "@/components/sales/pipeline-model";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  id: string;
  name: string;
  colorHex: string;
  order: number;
  closedKind: ClosedKind;
}

export interface PipelineDeal extends DealLite {
  rowOrder: number;
  title: string;
  expectedCloseAt: string | null;
  reminderAt: string | null;
  reminderNote: string | null;
  contact: { id: string; name: string } | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
}

type Tab = "pipeline" | "forecast";

const DATE_SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

export function SalesScreen({
  workspaceId,
  stages,
  initialDeals,
  canCreate,
  stageManager,
}: {
  workspaceId: string;
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
  canCreate: boolean;
  /** Dialog zarządzania etapami — renderowany przez stronę, gdy rola pozwala. */
  stageManager?: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [deals, setDeals] = useState<PipelineDeal[]>(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startPatch] = useTransition();

  // Serwer jest źródłem prawdy po revalidate; nie nadpisujemy w trakcie
  // przeciągania, bo karta uciekłaby spod kursora.
  useEffect(() => {
    if (activeId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeals(initialDeals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeals.map((d) => `${d.id}:${d.stageId}:${d.rowOrder}`).join(",")]);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);
  const stageById = useMemo(() => new Map(sortedStages.map((s) => [s.id, s])), [sortedStages]);
  const byStage = useMemo(() => {
    const m = new Map<string, PipelineDeal[]>();
    for (const s of sortedStages) m.set(s.id, []);
    for (const d of deals) m.get(d.stageId)?.push(d);
    for (const arr of m.values()) arr.sort((a, b) => a.rowOrder - b.rowOrder);
    return m;
  }, [sortedStages, deals]);

  const now = useNowAfterMount();
  const quarter = useMemo(() => quarterOf(new Date()), []);
  const open = openDeals(deals, stageById);
  const won = wonInQuarter(deals, stageById, quarter);
  const pipelineSums = sumByCurrency(open);

  // „Najbliższy krok" = deal z najwcześniejszym przypomnieniem, a gdy nikt nie
  // ma przypomnienia — z najbliższą datą zamknięcia.
  const withReminder = deals
    .filter((d) => d.reminderAt !== null)
    .sort((a, b) => Date.parse(a.reminderAt!) - Date.parse(b.reminderAt!));
  const nextSteps =
    withReminder.length > 0
      ? withReminder
      : open
          .filter((d) => d.expectedCloseAt !== null)
          .sort((a, b) => Date.parse(a.expectedCloseAt!) - Date.parse(b.expectedCloseAt!));
  const nextStep = nextSteps[0] ?? null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

  const stageOfOver = (overId: string): string | null => {
    if (overId.startsWith("col:")) return overId.slice(4);
    return deals.find((d) => d.id === overId)?.stageId ?? null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const id = String(e.active.id);
    const target = stageOfOver(String(e.over.id));
    if (!target) return;
    setDeals((prev) => prev.map((d) => (d.id === id && d.stageId !== target ? { ...d, stageId: target } : d)));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const overId = String(e.over.id);
    const deal = deals.find((d) => d.id === id);
    const stageId = stageOfOver(overId);
    if (!deal || !stageId) return;

    const col = byStage.get(stageId) ?? [];
    const index = overId.startsWith("col:")
      ? col.length
      : (() => {
          const cur = col.findIndex((d) => d.id === id);
          const over = col.findIndex((d) => d.id === overId);
          return cur === -1 ? over + 1 : over;
        })();
    const rest = col.filter((d) => d.id !== id);
    const before = index > 0 ? rest[index - 1] : null;
    const after = index < rest.length ? rest[index] : null;
    const rowOrder =
      before && after ? (before.rowOrder + after.rowOrder) / 2
      : before ? before.rowOrder + 1
      : after ? after.rowOrder / 2
      : 1;
    if (deal.stageId === stageId && deal.rowOrder === rowOrder) return;

    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stageId, rowOrder } : d)));
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("dealId", id);
    fd.set("stageId", stageId);
    fd.set("rowOrder", String(rowOrder));
    startPatch(() => {
      void moveDealAction(fd).then(() => router.refresh());
    });
  };

  return (
    <div
      data-ui="sales"
      className="flex min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Plan sprzedaży</h1>
        <span className="text-xs text-muted-foreground">{quarter.label}</span>
        <span className="flex-1" />
        <Segmented
          aria-label="Widok planu sprzedaży"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pipeline", label: "Pipeline" },
            { value: "forecast", label: "Prognoza" },
          ]}
        />
        {stageManager}
        {canCreate && (
          <Button render={<Link href={`/w/${workspaceId}/sales/new`} />}>
            <IconPlus width={14} height={14} />
            Nowy deal
          </Button>
        )}
      </header>

      <div className="flex shrink-0 gap-3 px-8 py-3.5 max-md:flex-wrap max-md:px-4">
        <Tile label={`Wygrane ${quarter.label.split(" ")[0]}`}>
          <span className="font-mono text-lg font-semibold text-success-text">
            {formatSums(sumByCurrency(won))}
          </span>
          <span className="text-2xs text-fg-3">
            {won.length} {plPlural(won.length, "deal", "deale", "dealów")}
          </span>
        </Tile>
        <Tile label="W pipeline">
          <span className="font-mono text-lg font-semibold">{formatSums(pipelineSums)}</span>
          <span className="text-2xs text-fg-3">
            {open.length} {plPlural(open.length, "deal", "deale", "dealów")}
          </span>
        </Tile>
        <NextStepTile workspaceId={workspaceId} deals={nextSteps} now={now} />
      </div>

      {tab === "forecast" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-canvas px-8 pb-5 max-md:px-4">
          <ForecastTable stages={sortedStages} byStage={byStage} />
        </div>
      ) : (
        <DndContext
          id="sales-pipeline"
          sensors={sensors}
          collisionDetection={collisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => `Podniesiono deal ${active.id}`,
              onDragOver: ({ active, over }) => (over ? `Deal ${active.id} nad ${over.id}` : undefined),
              onDragEnd: ({ active, over }) =>
                over ? `Upuszczono deal ${active.id} na ${over.id}` : `Anulowano przeniesienie deala ${active.id}`,
              onDragCancel: ({ active }) => `Anulowano przeniesienie deala ${active.id}`,
            },
          }}
        >
          <SalesPipelineMobile workspaceId={workspaceId} stages={sortedStages} deals={deals} />
          <div className="min-h-0 flex-1 overflow-auto bg-canvas px-8 pt-1 pb-5 max-md:hidden">
            <div className="flex items-start gap-3">
              {sortedStages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  workspaceId={workspaceId}
                  stage={stage}
                  deals={byStage.get(stage.id) ?? []}
                  activeId={activeId}
                  highlightId={nextStep?.id ?? null}
                  canCreate={canCreate}
                  now={now}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}

      <footer
        data-ui="sales-footer"
        className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-fg-2 max-md:px-4"
      >
        {deals.length} {plPlural(deals.length, "deal", "deale", "dealów")} · pipeline {formatSums(pipelineSums)}
      </footer>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-[180px] flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3">
      <p className="mb-0.5 text-2xs text-fg-3">{label}</p>
      <div className="flex flex-wrap items-baseline gap-1.5">{children}</div>
    </div>
  );
}

// Kafel „Najbliższy krok" = przypomnienia sprzedażowe (F12-K70/K71). Pierwszy
// wiersz na kaflu, cała lista w popoverze — makieta ma tylko trzy kafle.
function NextStepTile({
  workspaceId,
  deals,
  now,
}: {
  workspaceId: string;
  deals: PipelineDeal[];
  now: number | null;
}) {
  const first = deals[0];
  if (!first) {
    return (
      <Tile label="Najbliższy krok">
        <span className="text-sm text-muted-foreground">Brak przypomnień</span>
      </Tile>
    );
  }
  const when = first.reminderAt ?? first.expectedCloseAt;

  return (
    <Popover>
      <PopoverTrigger
        className="min-w-[180px] flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3 text-left outline-none hover:border-input-border-hover hover:bg-n-100 active:bg-n-200 data-popup-open:border-input-border-hover"
        aria-label="Pokaż nadchodzące przypomnienia"
      >
        <p className="mb-0.5 text-2xs text-fg-3">Najbliższy krok</p>
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-semibold">{first.title}</span>
          {when && <DueLabel iso={when} now={now} />}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-1">
        <p className="eyebrow px-2 py-1.5">Nadchodzące przypomnienia</p>
        <ul className="max-h-[280px] overflow-auto">
          {deals.slice(0, 8).map((d) => {
            const iso = d.reminderAt ?? d.expectedCloseAt;
            return (
              <li key={d.id}>
                <Link
                  href={`/w/${workspaceId}/sales/${d.id}`}
                  className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none hover:bg-n-100 active:bg-n-200"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                    {iso && <DueLabel iso={iso} now={now} />}
                  </span>
                  {d.reminderNote && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">{d.reminderNote}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function DueLabel({ iso, now }: { iso: string; now: number | null }) {
  const d = new Date(iso);
  const overdue = now !== null && d.getTime() < now;
  return (
    <span className={cn("font-mono text-2xs", overdue ? "text-danger-text" : "text-fg-3")}>
      {overdue ? "" : "do "}
      {d.toLocaleDateString("pl-PL", DATE_SHORT)}
    </span>
  );
}

function ForecastTable({
  stages,
  byStage,
}: {
  stages: PipelineStage[];
  byStage: Map<string, PipelineDeal[]>;
}) {
  const rows = stages.map((s) => {
    const list = byStage.get(s.id) ?? [];
    const closes = list
      .map((d) => d.expectedCloseAt)
      .filter((v): v is string => v !== null)
      .sort();
    return { stage: s, count: list.length, sums: sumByCurrency(list), nearest: closes[0] ?? null };
  });
  return (
    <DataTable
      wrapperClassName="bg-card"
      footer={<DataFooter>{stages.length} {plPlural(stages.length, "etap", "etapy", "etapów")}</DataFooter>}
    >
      <DataThead>
        <tr>
          <DataTh width={260}>Etap</DataTh>
          <DataTh align="right" width={90}>Dealów</DataTh>
          <DataTh align="right" width={180}>Wartość</DataTh>
          <DataTh width={180}>Najbliższe zamknięcie</DataTh>
        </tr>
      </DataThead>
      <tbody>
        {rows.map((r) => (
          <DataTr key={r.stage.id}>
            <DataTd>
              <span className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: r.stage.colorHex }} />
                {r.stage.name}
              </span>
            </DataTd>
            <DataTd align="right" className="font-mono text-xs">{r.count}</DataTd>
            <DataTd align="right" className="font-mono text-xs">{formatSums(r.sums)}</DataTd>
            <DataTd className="font-mono text-xs text-muted-foreground">
              {r.nearest ? new Date(r.nearest).toLocaleDateString("pl-PL") : "—"}
            </DataTd>
          </DataTr>
        ))}
      </tbody>
    </DataTable>
  );
}

function StageColumn({
  workspaceId,
  stage,
  deals,
  activeId,
  highlightId,
  canCreate,
  now,
}: {
  workspaceId: string;
  stage: PipelineStage;
  deals: PipelineDeal[];
  activeId: string | null;
  highlightId: string | null;
  canCreate: boolean;
  now: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}` });
  const won = isWonStage(stage);

  return (
    <section ref={setNodeRef} data-ui="stage-column" data-stage-id={stage.id} className="w-[264px] shrink-0">
      <div className="flex h-8 items-center gap-1.5 px-1">
        <span className={cn("eyebrow truncate", won ? "text-chip-green-fg" : "text-fg-2")}>{stage.name}</span>
        <span className="shrink-0 font-mono text-2xs text-fg-3">
          · {deals.length} · {formatSums(sumByCurrency(deals))}
        </span>
        {canCreate && (
          <Link
            href={`/w/${workspaceId}/sales/new?stageId=${stage.id}`}
            aria-label={`Nowy deal w etapie ${stage.name}`}
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            <IconPlus width={13} height={13} />
          </Link>
        )}
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <ul
          className={cn(
            "flex min-h-[52px] flex-col gap-2 rounded-lg",
            isOver && "bg-selected shadow-[inset_0_0_0_1px_var(--orange-300)]",
          )}
        >
          {deals.map((d) => (
            <DealCard
              key={d.id}
              workspaceId={workspaceId}
              deal={d}
              won={won}
              dragging={activeId === d.id}
              highlighted={highlightId === d.id}
              now={now}
            />
          ))}
          {deals.length === 0 && (
            <li className="rounded-lg border border-dashed border-input-border px-3 py-4 text-center text-xs text-muted-foreground">
              Brak dealów
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function DealCard({
  workspaceId,
  deal,
  won,
  dragging,
  highlighted,
  now,
}: {
  workspaceId: string;
  deal: PipelineDeal;
  won: boolean;
  dragging: boolean;
  highlighted: boolean;
  now: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const meta = cardMeta(deal, now);

  return (
    <li
      ref={setNodeRef}
      data-ui="deal-card"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: dragging || isDragging ? 0.6 : won ? 0.85 : 1 }}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/w/${workspaceId}/sales/${deal.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "block rounded-lg border border-border bg-card px-3 py-2.5 outline-none hover:border-input-border-hover active:border-n-400",
          highlighted && "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]",
        )}
      >
        <p className="mb-1.5 text-sm font-medium leading-[18px]">{deal.title}</p>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-2xs text-n-700">
            {deal.valueAmount != null ? formatAmount(deal.valueAmount, deal.valueCurrency) : "—"}
          </span>
          {won && <Chip hue="green" dot size="sm">Wygrany</Chip>}
          {deal.owner && (
            <span className="ml-auto">
              <Avatar name={deal.owner.name} src={deal.owner.avatarUrl} size={20} />
            </span>
          )}
        </div>
        {meta && (
          <div
            className={cn(
              "mt-1.5 flex items-center gap-1.5 border-t pt-1.5",
              highlighted ? "border-orange-100" : "border-n-100",
            )}
          >
            <meta.Icon width={11} height={11} className={meta.danger ? "text-danger-text" : "text-n-500"} />
            <span className={cn("truncate text-2xs", meta.danger ? "font-medium text-danger-text" : "text-fg-2")}>
              {meta.label}
            </span>
          </div>
        )}
      </Link>
    </li>
  );
}

// Trzeci wiersz karty: przypomnienie → termin zamknięcia → kontakt.
function cardMeta(
  deal: PipelineDeal,
  now: number | null,
): { Icon: typeof IconCalendar; label: string; danger: boolean } | null {
  if (deal.reminderAt) {
    const d = new Date(deal.reminderAt);
    const overdue = now !== null && d.getTime() < now;
    return {
      Icon: overdue ? IconWarning : IconReminders,
      label: `przypomnienie ${d.toLocaleDateString("pl-PL", DATE_SHORT)}`,
      danger: overdue,
    };
  }
  if (deal.expectedCloseAt) {
    return {
      Icon: IconCalendar,
      label: `zamknięcie ${new Date(deal.expectedCloseAt).toLocaleDateString("pl-PL", DATE_SHORT)}`,
      danger: false,
    };
  }
  if (deal.contact) return { Icon: IconContacts, label: `kontakt: ${deal.contact.name}`, danger: false };
  return null;
}

// „Teraz" dopiero po zamontowaniu — na serwerze nie ma zegara użytkownika,
// a różnica SSR/klient wywołałaby błąd hydracji na kolorze terminu.
function useNowAfterMount(): number | null {
  const [now, setNow] = useState<number | null>(null);
  // Jednorazowe „teraz" po hydracji — bez tego SSR i klient rysowałyby inny
  // kolor terminu i React zgłosiłby niezgodność.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);
  return now;
}
