"use client";

// F12-K73 v3: Multi-line Task Line.
// - Każda linia (TaskLineRow) renderuje się jako osobna sekcja: header
//   (nazwa + delete + create) + flow (kafelki + strzałki + drop zone).
// - Start/End w danej linii są auto-pozycjonowane (Start zawsze na początku,
//   End zawsze na końcu). Dropping nowego task'a → wstawia PRZED End.
// - "+ Nowa linia" przycisk na dole tworzy kolejną pustą linię.

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  ChevronDown,
  CornerDownLeft,
  X,
  Flag,
  FlagOff,
  Square,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  appendTaskToFlowAction,
  reorderTaskLineAction,
  removeFromFlowAction,
  setFlowMarkInLineAction,
  createLineAction,
  renameLineAction,
  deleteLineAction,
} from "@/app/(app)/w/[workspaceId]/c/taskline-actions";

export type TaskLineFlowItem = {
  id: string; // ProcessNode id
  taskId: string;
  taskTitle: string;
  statusName: string | null;
  statusColor: string | null;
  displayId: number | null;
  flowMark: "start" | "end" | null;
  x: number;
  lineId: string;
};

export type TaskLineRowMeta = {
  id: string;
  name: string;
  order: number;
};

export type BoardTaskMeta = {
  id: string;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  displayId: number;
};

export function TaskLineFlow({
  workspaceId,
  canvasId,
  initialItems,
  initialRows,
  boardTasks,
  canEdit,
  onPlacedTaskIdsChange,
}: {
  workspaceId: string;
  canvasId: string;
  initialItems: TaskLineFlowItem[];
  initialRows: TaskLineRowMeta[];
  boardTasks: Map<string, BoardTaskMeta>;
  canEdit: boolean;
  // Notyfikuje parent o aktualnym secie taskId'ów w jakiejkolwiek linii.
  // Parent używa do filtrowania sidebar'a (dropowane taski znikają z listy
  // available, usunięte z flow wracają).
  onPlacedTaskIdsChange?: (ids: Set<string>) => void;
}) {
  const [items, setItems] = useState<TaskLineFlowItem[]>(initialItems);
  const [rows, setRows] = useState<TaskLineRowMeta[]>(initialRows);
  const [, startTransition] = useTransition();

  // Notyfikacja parent'a o zmianach placedTaskIds — sidebar refresh.
  useEffect(() => {
    if (!onPlacedTaskIdsChange) return;
    onPlacedTaskIdsChange(new Set(items.map((i) => i.taskId)));
  }, [items, onPlacedTaskIdsChange]);

  // Items pogrupowane per linia + posortowane po x asc.
  const itemsByLine = useMemo(() => {
    const map = new Map<string, TaskLineFlowItem[]>();
    for (const row of rows) map.set(row.id, []);
    for (const it of items) {
      const bucket = map.get(it.lineId);
      if (bucket) bucket.push(it);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.x - b.x);
    return map;
  }, [items, rows]);

  // ─────────── Drop z sidebar'a ──────────────────────────────────────────

  const handleSidebarDrop = (
    e: React.DragEvent,
    lineId: string,
    insertAfterIdx: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit) return;

    const taskId = e.dataTransfer.getData("application/x-flovly-task-id");
    if (!taskId) return;
    if (items.find((i) => i.taskId === taskId)) return; // dedup global

    const meta = boardTasks.get(taskId);
    if (!meta) return;

    // Optimistic — wstaw tymczasowy kafelek (server policzy ostateczny x).
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: TaskLineFlowItem = {
      id: tempId,
      taskId,
      taskTitle: meta.title,
      statusName: meta.statusName,
      statusColor: meta.statusColor,
      displayId: meta.displayId,
      flowMark: null,
      x: 0, // placeholder, server zwróci prawdziwy
      lineId,
    };
    setItems((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const result = await appendTaskToFlowAction({
        canvasId,
        lineId,
        taskId,
        insertAfterIndex: insertAfterIdx >= 0 ? insertAfterIdx : undefined,
      });
      if (result.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === tempId ? { ...it, id: result.nodeId, x: result.x } : it,
          ),
        );
      } else {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
      }
    });
  };

  // ─────────── Reorder (dnd-kit, per linia) ──────────────────────────────

  const handleDragEnd = (e: DragEndEvent, lineId: string) => {
    if (!canEdit) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const lineItems = itemsByLine.get(lineId) ?? [];
    const body = lineItems.filter((i) => i.flowMark === null);

    const oldIdx = body.findIndex((i) => i.id === active.id);
    const newIdx = body.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const nextBody = arrayMove(body, oldIdx, newIdx);
    // Optimistic — przepisujemy x'y body (1000, 2000, ...). Start/End mają
    // pozycje sztywne (Start = 0, End = max).
    const startNode = lineItems.find((i) => i.flowMark === "start");
    const endNode = lineItems.find((i) => i.flowMark === "end");
    const nextItems = items.map((it) => {
      if (it.lineId !== lineId) return it;
      if (it === startNode) return { ...it, x: 0 };
      if (it === endNode) return { ...it, x: (nextBody.length + 1) * 1000 };
      const idx = nextBody.findIndex((n) => n.id === it.id);
      if (idx === -1) return it;
      return { ...it, x: (idx + 1) * 1000 };
    });
    setItems(nextItems);

    startTransition(async () => {
      const result = await reorderTaskLineAction({
        canvasId,
        lineId,
        orderedBodyNodeIds: nextBody.map((it) => it.id),
      });
      if (!result.ok) {
        setItems(items); // rollback
      }
    });
  };

  // ─────────── Remove ────────────────────────────────────────────────────

  const handleRemove = (nodeId: string) => {
    if (!canEdit) return;
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== nodeId));
    startTransition(async () => {
      const result = await removeFromFlowAction({ nodeId });
      if (!result.ok) {
        setItems(snapshot);
      }
    });
  };

  // ─────────── Flow mark (start / end / clear) ───────────────────────────

  const handleFlowMark = (
    nodeId: string,
    lineId: string,
    mark: "start" | "end" | null,
  ) => {
    if (!canEdit) return;
    const snapshot = items;
    // Optimistic: ustaw mark + przesuń wizualnie na początek/koniec.
    // Wyczyść poprzedniego holdera tego samego markera w tej linii.
    setItems((prev) => {
      const lineItems = prev.filter((i) => i.lineId === lineId);
      const targetIdx = lineItems.findIndex((i) => i.id === nodeId);
      if (targetIdx === -1) return prev;
      const others = lineItems.filter((i) => i.id !== nodeId);
      const minX = others.length > 0 ? Math.min(...others.map((i) => i.x)) : 0;
      const maxX = others.length > 0 ? Math.max(...others.map((i) => i.x)) : 0;
      return prev.map((it) => {
        if (it.lineId !== lineId) return it;
        if (it.id === nodeId) {
          let newX = it.x;
          if (mark === "start") newX = minX - 1000;
          else if (mark === "end") newX = maxX + 1000;
          return { ...it, flowMark: mark, x: newX };
        }
        if (it.flowMark === mark && mark !== null) {
          return { ...it, flowMark: null };
        }
        return it;
      });
    });
    startTransition(async () => {
      const result = await setFlowMarkInLineAction({
        canvasId,
        lineId,
        nodeId,
        mark,
      });
      if (!result.ok) setItems(snapshot);
    });
  };

  // ─────────── Line management ───────────────────────────────────────────

  const handleCreateLine = () => {
    if (!canEdit) return;
    startTransition(async () => {
      const result = await createLineAction({ canvasId });
      if (result.ok) {
        setRows((prev) => [
          ...prev,
          { id: result.lineId, name: result.name, order: result.order },
        ]);
      }
    });
  };

  const handleRenameLine = (lineId: string, name: string) => {
    if (!canEdit) return;
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r.id === lineId ? { ...r, name } : r)));
    startTransition(async () => {
      const result = await renameLineAction({ lineId, name });
      if (!result.ok) setRows(snapshot);
    });
  };

  const handleDeleteLine = (lineId: string) => {
    if (!canEdit) return;
    if (rows.length <= 1) return; // ostatniej nie kasuj
    const snapshot = { rows, items };
    setRows((prev) => prev.filter((r) => r.id !== lineId));
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
    startTransition(async () => {
      const result = await deleteLineAction({ lineId });
      if (!result.ok) {
        setRows(snapshot.rows);
        setItems(snapshot.items);
      }
    });
  };

  // ─────────── Render ────────────────────────────────────────────────────

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.order - b.order),
    [rows],
  );

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-y-auto p-4">
      {sortedRows.map((row) => (
        <LineSection
          key={row.id}
          workspaceId={workspaceId}
          row={row}
          items={itemsByLine.get(row.id) ?? []}
          canEdit={canEdit}
          canDelete={sortedRows.length > 1}
          onDrop={(e, idx) => handleSidebarDrop(e, row.id, idx)}
          onDragEnd={(e) => handleDragEnd(e, row.id)}
          onRemove={handleRemove}
          onFlowMark={(nodeId, mark) => handleFlowMark(nodeId, row.id, mark)}
          onRename={(name) => handleRenameLine(row.id, name)}
          onDeleteLine={() => handleDeleteLine(row.id)}
        />
      ))}

      {canEdit && (
        <button
          type="button"
          onClick={handleCreateLine}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-dashed border-border bg-background px-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground max-md:self-stretch"
        >
          <Plus size={12} />
          <span>Nowa linia</span>
        </button>
      )}
    </div>
  );
}

// ─────────── LineSection — pojedyncza linia ──────────────────────────────

function LineSection({
  workspaceId,
  row,
  items,
  canEdit,
  canDelete,
  onDrop,
  onDragEnd,
  onRemove,
  onFlowMark,
  onRename,
  onDeleteLine,
}: {
  workspaceId: string;
  row: TaskLineRowMeta;
  items: TaskLineFlowItem[];
  canEdit: boolean;
  canDelete: boolean;
  onDrop: (e: React.DragEvent, insertAfterIdx: number) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onRemove: (nodeId: string) => void;
  onFlowMark: (nodeId: string, mark: "start" | "end" | null) => void;
  onRename: (name: string) => void;
  onDeleteLine: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(row.name);

  // Itemy w kolejności renderu: Start → body → End.
  const startItem = items.find((i) => i.flowMark === "start") ?? null;
  const endItem = items.find((i) => i.flowMark === "end") ?? null;
  const body = items.filter((i) => i.flowMark === null);
  const renderItems = [
    ...(startItem ? [startItem] : []),
    ...body,
    ...(endItem ? [endItem] : []),
  ];
  // dnd-kit sortable ids — tylko body (Start/End nie są sortowalne).
  const bodyIds = useMemo(() => body.map((b) => b.id), [body]);

  const isEmpty = items.length === 0;

  return (
    <section className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {editing && canEdit ? (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draftName.trim() && draftName.trim() !== row.name) {
                onRename(draftName.trim());
              } else {
                setDraftName(row.name);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraftName(row.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="flex-1 border-b border-border bg-transparent text-[0.85rem] font-semibold outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setEditing(true)}
            className="flex-1 text-left text-[0.85rem] font-semibold text-foreground hover:text-primary"
            title={canEdit ? "Kliknij aby zmienić nazwę" : ""}
          >
            {row.name}
          </button>
        )}
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          {items.length} {items.length === 1 ? "zadanie" : "zadań"}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Zmień nazwę"
            title="Zmień nazwę"
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil size={11} />
          </button>
        )}
        {canEdit && canDelete && (
          <button
            type="button"
            onClick={onDeleteLine}
            aria-label="Skasuj linię"
            title="Skasuj linię (wraz z zadaniami)"
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Body — pusta linia lub flow z kafelkami w grid'cie 3 kolumn na desktop */}
      {isEmpty ? (
        <EmptyLineDropZone canEdit={canEdit} onDrop={(e) => onDrop(e, -1)} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={bodyIds} strategy={rectSortingStrategy}>
            <div
              // Grid daje przewidywalne 3 kafelki w rzędzie. Strzałki sa
              // absolute-positioned wewnątrz każdej komórki — right
              // arrow w obrębie rzędu, down arrow na końcu rzędu (jasny
              // wskaźnik "kontynuacja w nowym rzędzie").
              // Mobile: grid-cols-1 = stack pionowy.
              className="grid grid-cols-1 gap-y-6 md:grid-cols-3 md:gap-x-10 md:gap-y-12"
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                // Append na koniec body (przed End jeśli istnieje).
                onDrop(e, body.length - 1);
              }}
            >
              {renderItems.map((item, i) => {
                const isLast = i === renderItems.length - 1;
                const isAnchor = item.flowMark !== null;
                const isEndAnchor = item.flowMark === "end";
                // 3 kafelki w rzędzie na desktop → indeksy 2, 5, 8... to koniec rzędu.
                const isEndOfRow = (i + 1) % 3 === 0;
                // Czy dropzone będzie ostatnim element'em w grid'cie (drop
                // appendowany po wszystkich) — gdy tak, dawajmy divider'a po
                // tym kafelku, bo jest "ostatni przed wrap" jeśli kończy rząd.
                const willHaveMoreContent = !isLast || canEdit;
                const showWrapDivider =
                  isEndOfRow && willHaveMoreContent && !isLast;
                return (
                  <Fragment key={item.id}>
                    <FlowSlot
                      workspaceId={workspaceId}
                      item={item}
                      isLast={isLast}
                      isAnchor={isAnchor}
                      isEndAnchor={isEndAnchor}
                      isEndOfRow={isEndOfRow}
                      onRemove={() => onRemove(item.id)}
                      onFlowMark={(m) => onFlowMark(item.id, m)}
                      canEdit={canEdit}
                    />
                    {showWrapDivider && <RowWrapDivider />}
                  </Fragment>
                );
              })}
              {canEdit && (
                <EndDropCell
                  onDrop={(e) => onDrop(e, body.length - 1)}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

// ─────────── FlowSlot ─────────────────────────────────────────────────────
// Pojedyncza komórka grid'u. Card w środku + absolute right-arrow w obrębie
// rzędu. Na końcu rzędu (desktop) NIE rysujemy strzałki — w jej miejscu jest
// RowWrapDivider (full-width col-span-3 element wstawiony w grid). Mobile:
// zawsze ↓ down arrow między kafelkami (bez divider'a — single column anyway).
// Po End anchor'ze NIE rysujemy strzałki — End to terminator linii.

function FlowSlot({
  workspaceId,
  item,
  isLast,
  isAnchor,
  isEndAnchor,
  isEndOfRow,
  onRemove,
  onFlowMark,
  canEdit,
}: {
  workspaceId: string;
  item: TaskLineFlowItem;
  isLast: boolean;
  isAnchor: boolean;
  isEndAnchor: boolean;
  isEndOfRow: boolean;
  onRemove: () => void;
  onFlowMark: (mark: "start" | "end" | null) => void;
  canEdit: boolean;
}) {
  const sortable = useSortable({ id: item.id, disabled: !canEdit || isAnchor });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showArrow = !isLast && !isEndAnchor;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <TaskLineCard
        workspaceId={workspaceId}
        item={item}
        isAnchor={isAnchor}
        listeners={canEdit && !isAnchor ? listeners : undefined}
        onRemove={onRemove}
        onFlowMark={onFlowMark}
        canEdit={canEdit}
      />
      {showArrow && (
        <>
          {/* Desktop: → right (TYLKO gdy nie koniec rzędu — koniec rzędu
              ma RowWrapDivider w grid'cie po tym slot'cie). */}
          {!isEndOfRow && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-7 top-1/2 hidden -translate-y-1/2 text-muted-foreground/60 md:block"
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </span>
          )}
          {/* Mobile: zawsze ↓ */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 text-muted-foreground/60 md:hidden"
          >
            <ChevronDown size={18} strokeWidth={2.5} />
          </span>
        </>
      )}
    </div>
  );
}

// ─────────── RowWrapDivider — full-width connector między rzędami ─────────
// Tylko desktop. Wizualnie spinają rząd 1 z rzędem 2: gradientowa linia +
// circular icon ↩ wskazująca że flow "schodzi w lewo, do następnego rzędu".
// Wstawiany w grid'cie po każdym kafelku na pozycji (i+1) % 3 === 0 (oprócz
// ostatniego). col-span-full sprawia że zajmuje pełną szerokość 3 kolumn.

function RowWrapDivider() {
  return (
    <div className="col-span-full hidden items-center gap-3 py-1 md:flex">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-primary/60" />
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm">
        <CornerDownLeft size={14} strokeWidth={2.5} />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-primary/60 via-primary/40 to-transparent" />
    </div>
  );
}

// ─────────── Card — kanban-style ──────────────────────────────────────────

function TaskLineCard({
  workspaceId,
  item,
  isAnchor,
  listeners,
  onRemove,
  onFlowMark,
  canEdit,
}: {
  workspaceId: string;
  item: TaskLineFlowItem;
  isAnchor: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: any;
  onRemove: () => void;
  onFlowMark: (mark: "start" | "end" | null) => void;
  canEdit: boolean;
}) {
  const ring =
    item.flowMark === "start"
      ? "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background"
      : item.flowMark === "end"
        ? "ring-2 ring-rose-500/70 ring-offset-2 ring-offset-background"
        : "";

  return (
    <div
      {...listeners}
      className={`group relative flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md ${ring} ${listeners ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* F12-K112: Link overlay otwiera task drawer po kliku. Anchor nodes
          (START/END placeholdery) nie mają taskId więc skip. Pointer sensor
          ma activationConstraint distance: 6 — krótki klik bez ruchu trafia
          Link, ruch > 6px aktywuje drag i Link nie odpala onClick.
          Buttons (X / Start / Koniec / Clear) mają e.stopPropagation() i
          relative z-10 — siedzą NAD Link overlay'em, więc ich klik nie
          triggers nav. */}
      {!isAnchor && (
        <Link
          href={`/w/${workspaceId}/t/${item.taskId}`}
          aria-label={`Otwórz zadanie: ${item.taskTitle}`}
          className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      )}
      {item.flowMark === "start" && (
        <span className="absolute -top-2 left-3 rounded-full bg-emerald-500 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white shadow-sm">
          Start
        </span>
      )}
      {item.flowMark === "end" && (
        <span className="absolute -top-2 left-3 rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white shadow-sm">
          Koniec
        </span>
      )}

      <div className="relative z-10 flex items-center gap-2">
        {item.statusColor && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: item.statusColor }}
          />
        )}
        {item.displayId !== null && (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
            #{item.displayId}
          </span>
        )}
        {item.statusName && (
          <span
            className="inline-flex items-center rounded-full px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em]"
            style={{
              color: item.statusColor ?? "#94A3B8",
              background: `${item.statusColor ?? "#94A3B8"}1A`,
            }}
          >
            {item.statusName}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Usuń z linii"
            title="Usuń z linii"
            className="ml-auto grid h-5 w-5 place-items-center rounded text-muted-foreground/0 transition-[color,background-color] group-hover:text-muted-foreground hover:!bg-rose-500/10 hover:!text-rose-500"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="relative z-10 line-clamp-2 text-[0.88rem] font-semibold leading-tight text-foreground">
        {item.taskTitle}
      </div>

      {canEdit && (
        <div className="relative z-10 flex items-center gap-1 border-t border-border/60 pt-2">
          <FlowMarkButton
            active={item.flowMark === "start"}
            onClick={(e) => {
              e.stopPropagation();
              onFlowMark(item.flowMark === "start" ? null : "start");
            }}
            color="emerald"
            icon={<Flag size={10} />}
            label="Start"
          />
          <FlowMarkButton
            active={item.flowMark === "end"}
            onClick={(e) => {
              e.stopPropagation();
              onFlowMark(item.flowMark === "end" ? null : "end");
            }}
            color="rose"
            icon={<Square size={10} />}
            label="Koniec"
          />
          {item.flowMark !== null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlowMark(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Wyczyść oznaczenie"
              className="ml-auto grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <FlagOff size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FlowMarkButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  color: "emerald" | "rose";
  icon: React.ReactNode;
  label: string;
}) {
  const activeCls =
    color === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      data-active={active ? "true" : "false"}
      title={`Oznacz jako ${label.toLowerCase()}`}
      className={`inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${active ? activeCls : ""}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Grid-cell drop zone — kolejna komórka po ostatnim kafelku, na dropowanie
// nowego zadania. Wypełnia całą komórkę (w-full), wysokość zbliżona do karty.
function EndDropCell({ onDrop }: { onDrop: (e: React.DragEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
          e.preventDefault();
          setHover(true);
        }
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        setHover(false);
        onDrop(e);
      }}
      data-hover={hover ? "true" : "false"}
      className="grid min-h-[110px] w-full place-items-center rounded-xl border border-dashed border-border/60 bg-card/30 text-[0.78rem] text-muted-foreground/60 transition-[border-color,background-color,color] data-[hover=true]:border-primary/60 data-[hover=true]:bg-primary/5 data-[hover=true]:text-foreground"
    >
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">
        + dodaj zadanie
      </span>
    </div>
  );
}

function EmptyLineDropZone({
  canEdit,
  onDrop,
}: {
  canEdit: boolean;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDrop={canEdit ? (e) => { setHover(false); onDrop(e); } : undefined}
      onDragOver={canEdit ? (e) => {
        if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
          e.preventDefault();
          setHover(true);
        }
      } : undefined}
      onDragLeave={canEdit ? () => setHover(false) : undefined}
      data-hover={hover ? "true" : "false"}
      className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-card/20 px-6 text-center transition-[border-color,background-color] data-[hover=true]:border-primary/60 data-[hover=true]:bg-primary/5"
    >
      <p className="text-[0.85rem] font-medium text-foreground">
        Dodaj pierwsze zadanie
      </p>
      <p className="max-w-[40ch] text-[0.78rem] leading-[1.5] text-muted-foreground">
        Przeciągnij zadanie z listy po lewej, żeby utworzyć linię zadań.
      </p>
    </div>
  );
}
