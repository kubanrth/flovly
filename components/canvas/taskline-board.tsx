"use client";

// Linia zadań (B10): etapy jako pigułki spięte strzałkami + kolumna kart pod
// każdym etapem. Przeciągnięcie karty do innego etapu zmienia etap, w obrębie
// etapu — kolejność. Ostatni etap zwija starsze karty.
// Backend bez zmian: te same akcje z `c/taskline-actions.ts`.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  appendTaskToFlowAction,
  createLineAction,
  deleteLineAction,
  removeFromFlowAction,
  renameLineAction,
  reorderTaskLineAction,
  setFlowMarkInLineAction,
} from "@/app/(app)/w/[workspaceId]/c/taskline-actions";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { IconChevronDown, IconMore, IconPlus, IconTrash } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { TaskLinePool } from "@/components/canvas/taskline-pool";
import {
  bucketOlder,
  cardsByStage,
  plural,
  reorderIds,
  sortStages,
  type TaskLineCard,
  type TaskLineMember,
  type TaskLineStage,
  type TaskLineTask,
} from "@/components/canvas/taskline-stages";

const TASK_MIME = "application/x-flovly-task-id";
const NODE_MIME = "application/x-flovly-node-id";

type DropTarget = { stageId: string; beforeId: string | null };

export function TaskLineBoard({
  workspaceId,
  canvasId,
  canEdit,
  tasks,
  members,
  initialCards,
  initialStages,
}: {
  workspaceId: string;
  canvasId: string;
  canEdit: boolean;
  tasks: TaskLineTask[];
  members: TaskLineMember[];
  initialCards: TaskLineCard[];
  initialStages: TaskLineStage[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [stages, setStages] = useState(initialStages);
  const [activeStageId, setActiveStageId] = useState(initialStages[0]?.id ?? null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [expandedLast, setExpandedLast] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const [, startTransition] = useTransition();

  const ordered = useMemo(() => sortStages(stages), [stages]);
  const byStage = useMemo(() => cardsByStage(cards, ordered), [cards, ordered]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const placed = useMemo(() => new Set(cards.map((c) => c.taskId)), [cards]);
  const availableTasks = useMemo(
    () => tasks.filter((t) => !placed.has(t.id)),
    [tasks, placed],
  );
  const lastStageId = ordered[ordered.length - 1]?.id ?? null;

  // ── mutacje ────────────────────────────────────────────────────────────

  const addToStage = (taskId: string, stageId: string, beforeId: string | null) => {
    if (!canEdit || cards.some((c) => c.taskId === taskId)) return;
    const meta = tasksById.get(taskId);
    if (!meta) return;
    const body = (byStage.get(stageId) ?? []).filter((c) => c.flowMark === null);
    const at = beforeId ? body.findIndex((c) => c.id === beforeId) : -1;
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: TaskLineCard = {
      id: tempId,
      taskId,
      taskTitle: meta.title,
      displayId: meta.displayId,
      statusName: meta.statusName,
      statusColor: meta.statusColor,
      flowMark: null,
      x: at >= 0 ? (body[at]?.x ?? 0) - 0.5 : Number.MAX_SAFE_INTEGER,
      lineId: stageId,
    };
    setCards((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const res = await appendTaskToFlowAction({
        canvasId,
        lineId: stageId,
        taskId,
        insertAfterIndex: at > 0 ? at - 1 : at === 0 ? -1 : undefined,
      });
      setCards((prev) =>
        res.ok
          ? prev.map((c) => (c.id === tempId ? { ...c, id: res.nodeId, x: res.x } : c))
          : prev.filter((c) => c.id !== tempId),
      );
    });
  };

  const moveToStage = (nodeId: string, stageId: string) => {
    if (!canEdit) return;
    const card = cards.find((c) => c.id === nodeId);
    if (!card || card.lineId === stageId) return;
    const snapshot = cards;
    const tempX = Number.MAX_SAFE_INTEGER;
    setCards((prev) =>
      prev.map((c) => (c.id === nodeId ? { ...c, lineId: stageId, x: tempX } : c)),
    );
    startTransition(async () => {
      // Brak akcji „przenieś" — składamy ją z istniejących: usuń + dopnij.
      const removed = await removeFromFlowAction({ nodeId });
      if (!removed.ok) {
        setCards(snapshot);
        return;
      }
      const res = await appendTaskToFlowAction({
        canvasId,
        lineId: stageId,
        taskId: card.taskId,
      });
      setCards((prev) =>
        res.ok
          ? prev.map((c) => (c.id === nodeId ? { ...c, id: res.nodeId, x: res.x } : c))
          : prev.filter((c) => c.id !== nodeId),
      );
    });
  };

  const reorderInStage = (nodeId: string, stageId: string, beforeId: string | null) => {
    if (!canEdit || nodeId === beforeId) return;
    const body = (byStage.get(stageId) ?? []).filter((c) => c.flowMark === null);
    const nextIds = reorderIds(body.map((c) => c.id), nodeId, beforeId);
    const snapshot = cards;
    setCards((prev) =>
      prev.map((c) => {
        const at = nextIds.indexOf(c.id);
        return at === -1 || c.lineId !== stageId ? c : { ...c, x: (at + 1) * 1000 };
      }),
    );
    startTransition(async () => {
      const res = await reorderTaskLineAction({
        canvasId,
        lineId: stageId,
        orderedBodyNodeIds: nextIds,
      });
      if (!res.ok) setCards(snapshot);
    });
  };

  const removeCard = (nodeId: string) => {
    if (!canEdit) return;
    const snapshot = cards;
    setCards((prev) => prev.filter((c) => c.id !== nodeId));
    startTransition(async () => {
      const res = await removeFromFlowAction({ nodeId });
      if (!res.ok) setCards(snapshot);
    });
  };

  const setFlowMark = (nodeId: string, stageId: string, mark: "start" | "end" | null) => {
    if (!canEdit) return;
    const snapshot = cards;
    setCards((prev) =>
      prev.map((c) => {
        if (c.id === nodeId) return { ...c, flowMark: mark };
        if (c.lineId === stageId && mark !== null && c.flowMark === mark) {
          return { ...c, flowMark: null };
        }
        return c;
      }),
    );
    startTransition(async () => {
      const res = await setFlowMarkInLineAction({ canvasId, lineId: stageId, nodeId, mark });
      if (!res.ok) setCards(snapshot);
    });
  };

  const addStage = () => {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await createLineAction({ canvasId });
      if (res.ok) {
        setStages((prev) => [...prev, { id: res.lineId, name: res.name, order: res.order }]);
      }
    });
  };

  const renameStage = (stageId: string, name: string) => {
    if (!canEdit) return;
    const snapshot = stages;
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)));
    startTransition(async () => {
      const res = await renameLineAction({ lineId: stageId, name });
      if (!res.ok) setStages(snapshot);
    });
  };

  const deleteStage = (stageId: string) => {
    if (!canEdit || stages.length <= 1) return;
    const snapshot = { stages, cards };
    setStages((prev) => prev.filter((s) => s.id !== stageId));
    setCards((prev) => prev.filter((c) => c.lineId !== stageId));
    startTransition(async () => {
      const res = await deleteLineAction({ lineId: stageId });
      if (!res.ok) {
        setStages(snapshot.stages);
        setCards(snapshot.cards);
      }
    });
  };

  // ── drag & drop ────────────────────────────────────────────────────────

  const dragTypes = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(TASK_MIME) || e.dataTransfer.types.includes(NODE_MIME);

  const onDragOver = (e: React.DragEvent, target: DropTarget) => {
    if (!canEdit || !dragTypes(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  };

  const onDrop = (e: React.DragEvent, target: DropTarget) => {
    if (!canEdit) return;
    e.preventDefault();
    setDropTarget(null);
    const nodeId = e.dataTransfer.getData(NODE_MIME);
    if (nodeId) {
      const card = cards.find((c) => c.id === nodeId);
      if (!card) return;
      if (card.lineId === target.stageId) reorderInStage(nodeId, target.stageId, target.beforeId);
      else moveToStage(nodeId, target.stageId);
      return;
    }
    const taskId = e.dataTransfer.getData(TASK_MIME);
    if (taskId) addToStage(taskId, target.stageId, target.beforeId);
  };

  const totalCards = cards.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Pasek podpowiedzi + zarządzanie etapami (B10). */}
      <div className="flex flex-none items-center gap-2 border-b border-border bg-card px-6 py-2 max-md:px-4">
        <p className="text-xs text-muted-foreground max-md:hidden">
          Zadanie przechodzi etapy od lewej do prawej. Przeciągnij kartę, by zmienić etap.
        </p>
        <span className="flex-1" />
        {canEdit && (
          <StagesMenu
            stages={ordered}
            onAdd={addStage}
            onRename={(id) => setRenamingId(id)}
            onDelete={deleteStage}
            canDelete={stages.length > 1}
          />
        )}
        <BoardMoreMenu
          onOpenPool={canEdit ? () => setPoolOpen(true) : undefined}
          expandedLast={expandedLast}
          onToggleLast={() => setExpandedLast((v) => !v)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-canvas px-6 py-5 max-md:px-4">
        {/* Pigułki etapów spięte łącznikami ze strzałką. */}
        <div className="mb-4 flex items-center max-md:flex-col max-md:items-stretch max-md:gap-2">
          {ordered.map((stage, i) => {
            const count = byStage.get(stage.id)?.length ?? 0;
            const isActive = stage.id === activeStageId;
            const isLast = stage.id === lastStageId;
            return (
              <div key={stage.id} className="contents">
                {renamingId === stage.id ? (
                  <StageRenameField
                    name={stage.name}
                    onCancel={() => setRenamingId(null)}
                    onSubmit={(name) => {
                      setRenamingId(null);
                      if (name && name !== stage.name) renameStage(stage.id, name);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    data-ui="taskline-stage"
                    data-active={isActive ? "true" : "false"}
                    onClick={() => setActiveStageId(stage.id)}
                    onDoubleClick={() => canEdit && setRenamingId(stage.id)}
                    title={canEdit ? "Dwuklik zmienia nazwę etapu" : stage.name}
                    className={`inline-flex h-9 flex-none items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 ease-out focus-visible:shadow-[var(--focus)] focus-visible:outline-none ${
                      isActive
                        ? "bg-n-900 text-white hover:bg-n-800 active:bg-n-950"
                        : "border border-border bg-card text-foreground hover:bg-n-50 active:bg-n-100"
                    }`}
                  >
                    {stage.name}
                    <span
                      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-2xs font-medium ${
                        isActive
                          ? "bg-white/20 text-white"
                          : isLast
                            ? "bg-chip-green-bg text-chip-green-fg"
                            : "bg-n-100 text-fg-2"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )}
                {i < ordered.length - 1 && (
                  <span
                    aria-hidden
                    className="relative h-0.5 flex-1 bg-n-300 max-md:hidden"
                  >
                    <span className="absolute -right-px -top-[3px] h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-n-300" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Kolumny kart — jedna pod każdym etapem. */}
        <div className="flex items-start gap-3 max-md:flex-col max-md:gap-4">
          {ordered.map((stage) => {
            const all = byStage.get(stage.id) ?? [];
            const isLast = stage.id === lastStageId;
            const { shown, hidden } = isLast
              ? bucketOlder(all, expandedLast)
              : { shown: all, hidden: 0 };
            const showSlot = dropTarget?.stageId === stage.id;
            return (
              <div
                key={stage.id}
                className="flex min-w-0 flex-1 flex-col gap-2 max-md:w-full"
                onDragOver={(e) => onDragOver(e, { stageId: stage.id, beforeId: null })}
                onDragLeave={(e) => {
                  // Przejście między dziećmi kolumny też odpala dragleave.
                  if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node)) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => onDrop(e, { stageId: stage.id, beforeId: null })}
              >
                <p className="sr-only">{stage.name}</p>
                {shown.map((card) => (
                  <StageCard
                    key={card.id}
                    workspaceId={workspaceId}
                    card={card}
                    dimmed={isLast}
                    canEdit={canEdit}
                    assignees={tasksById.get(card.taskId)?.assignees ?? []}
                    onDragOver={(e) => onDragOver(e, { stageId: stage.id, beforeId: card.id })}
                    onDrop={(e) => onDrop(e, { stageId: stage.id, beforeId: card.id })}
                    onRemove={() => removeCard(card.id)}
                    onFlowMark={(m) => setFlowMark(card.id, stage.id, m)}
                  />
                ))}
                {showSlot && (
                  <div className="flex h-14 items-center justify-center rounded-lg border-[1.5px] border-dashed border-n-400 text-xs text-fg-3">
                    Upuść tutaj → {stage.name}
                  </div>
                )}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedLast(true)}
                    className="self-start rounded-sm px-1 py-0.5 text-xs font-medium text-orange-700 transition-colors duration-150 ease-out hover:text-orange-800 hover:underline focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:text-orange-900"
                  >
                    Pokaż {hidden} starsze…
                  </button>
                )}
                {all.length === 0 && !showSlot && (
                  <p className="rounded-lg border border-dashed border-input-border px-3 py-4 text-center text-xs text-fg-3">
                    Brak zadań
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex h-8 flex-none items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-fg-2 max-md:px-4">
        {plural(totalCards, ["zadanie", "zadania", "zadań"])} ·{" "}
        {plural(ordered.length, ["etap", "etapy", "etapów"])} · przeciąganie zmienia etap
      </div>

      {poolOpen && (
        <TaskLinePool
          tasks={availableTasks}
          members={members}
          onClose={() => setPoolOpen(false)}
        />
      )}
    </div>
  );
}

// ── karta ────────────────────────────────────────────────────────────────

function StageCard({
  workspaceId,
  card,
  dimmed,
  canEdit,
  assignees,
  onDragOver,
  onDrop,
  onRemove,
  onFlowMark,
}: {
  workspaceId: string;
  card: TaskLineCard;
  dimmed: boolean;
  canEdit: boolean;
  assignees: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onFlowMark: (mark: "start" | "end" | null) => void;
}) {
  return (
    <article
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData(NODE_MIME, card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.stopPropagation();
        onDragOver(e);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e);
      }}
      className={`group relative rounded-lg border border-border bg-card px-3 py-2.5 transition-colors duration-150 ease-out hover:bg-selected hover:shadow-[inset_2px_0_0_var(--orange-500)] ${
        dimmed ? "opacity-75" : ""
      } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Klik w kartę otwiera panel zadania; przyciski leżą nad tą warstwą. */}
      <Link
        href={`/w/${workspaceId}/t/${card.taskId}`}
        draggable={false}
        aria-label={`Otwórz zadanie: ${card.taskTitle}`}
        className="absolute inset-0 rounded-lg focus-visible:shadow-[var(--focus)] focus-visible:outline-none"
      />
      <p className="mb-1.5 line-clamp-2 text-sm font-medium leading-[18px] text-foreground">
        {card.taskTitle}
      </p>
      <div className="relative flex items-center gap-1.5">
        {card.displayId !== null && (
          <span className={`font-mono text-2xs text-fg-3 ${dimmed ? "line-through" : ""}`}>
            #{card.displayId}
          </span>
        )}
        {card.statusName && (
          <Chip hue={hueForColor(card.statusColor)} size="sm">
            {card.statusName}
          </Chip>
        )}
        {card.flowMark && (
          <Chip hue={card.flowMark === "start" ? "green" : "red"} size="sm">
            {card.flowMark === "start" ? "Start" : "Koniec"}
          </Chip>
        )}
        <span className="ml-auto inline-flex items-center">
          {assignees.slice(0, 2).map((a, i) => (
            <Avatar
              key={a.id}
              name={a.name ?? a.email}
              src={a.avatarUrl}
              size={20}
              className={i > 0 ? "-ml-1.5 border-2 border-card" : ""}
            />
          ))}
          {canEdit && (
            <CardMenu onRemove={onRemove} flowMark={card.flowMark} onFlowMark={onFlowMark} />
          )}
        </span>
      </div>
    </article>
  );
}

function CardMenu({
  flowMark,
  onFlowMark,
  onRemove,
}: {
  flowMark: "start" | "end" | null;
  onFlowMark: (mark: "start" | "end" | null) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutsideClose(open, ref, () => setOpen(false));
  return (
    <span className="relative ml-1" ref={ref}>
      <button
        type="button"
        aria-label="Akcje karty"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="grid h-6 w-6 place-items-center rounded-md text-transparent transition-colors duration-150 ease-out group-hover:text-muted-foreground hover:bg-n-100 hover:!text-foreground focus-visible:text-muted-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-200"
      >
        <IconMore width={14} height={14} />
      </button>
      {open && (
        <span className="absolute right-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] block w-52 rounded-lg border border-border bg-popover p-1 shadow-e2">
          <MenuRow
            label={flowMark === "start" ? "Usuń oznaczenie startu" : "Oznacz jako start"}
            onClick={() => {
              onFlowMark(flowMark === "start" ? null : "start");
              setOpen(false);
            }}
          />
          <MenuRow
            label={flowMark === "end" ? "Usuń oznaczenie końca" : "Oznacz jako koniec"}
            onClick={() => {
              onFlowMark(flowMark === "end" ? null : "end");
              setOpen(false);
            }}
          />
          <span className="my-1 block h-px bg-border" />
          <MenuRow
            label="Usuń z etapu"
            destructive
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          />
        </span>
      )}
    </span>
  );
}

// ── menu etapów / więcej ─────────────────────────────────────────────────

function StagesMenu({
  stages,
  onAdd,
  onRename,
  onDelete,
  canDelete,
}: {
  stages: TaskLineStage[];
  onAdd: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(open, ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-n-700 transition-colors duration-150 ease-out hover:bg-n-50 focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-100"
      >
        Etapy
        <IconChevronDown width={11} height={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] w-64 rounded-lg border border-border bg-popover p-1 shadow-e2">
          <MenuRow
            label="Nowy etap"
            icon={<IconPlus width={14} height={14} />}
            onClick={() => {
              onAdd();
              setOpen(false);
            }}
          />
          <span className="my-1 block h-px bg-border" />
          {stages.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <MenuRow
                label={s.name}
                className="flex-1"
                onClick={() => {
                  onRename(s.id);
                  setOpen(false);
                }}
              />
              <button
                type="button"
                disabled={!canDelete}
                aria-label={`Usuń etap ${s.name}`}
                onClick={() => {
                  onDelete(s.id);
                  setOpen(false);
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-chip-red-bg hover:text-danger-text focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-200 disabled:cursor-not-allowed disabled:text-n-300"
              >
                <IconTrash width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardMoreMenu({
  onOpenPool,
  expandedLast,
  onToggleLast,
}: {
  onOpenPool?: () => void;
  expandedLast: boolean;
  onToggleLast: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(open, ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Więcej"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-200"
      >
        <IconMore />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] w-56 rounded-lg border border-border bg-popover p-1 shadow-e2">
          {onOpenPool && (
            <MenuRow
              label="Pula zadań…"
              onClick={() => {
                onOpenPool();
                setOpen(false);
              }}
            />
          )}
          <MenuRow
            label={expandedLast ? "Zwiń starsze zadania" : "Pokaż starsze zadania"}
            onClick={() => {
              onToggleLast();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuRow({
  label,
  icon,
  destructive,
  className = "",
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-150 ease-out hover:bg-n-100 focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-200 ${
        destructive ? "text-danger-text" : "text-foreground"
      } ${className}`}
    >
      {icon && <span className="grid h-4 w-4 place-items-center text-muted-foreground">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function StageRenameField({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <input
      autoFocus
      value={draft}
      aria-label="Nazwa etapu"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSubmit(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(name);
          onCancel();
        }
      }}
      className="h-9 w-40 flex-none rounded-full border border-orange-500 bg-card px-3.5 text-sm font-semibold outline-none focus-visible:shadow-[var(--focus)]"
    />
  );
}

function useOutsideClose(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}
