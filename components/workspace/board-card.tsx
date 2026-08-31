"use client";

// C1 board card: icon · name · star · done/total progress ·
// avatars · „N po terminie”. The whole card is a stretched link; the star and
// the drag listeners sit above it.

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AvatarStack } from "@/components/ui/avatar";
import { IconBoards, IconStar, IconStarFilled } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { isSaved, progressTone, type BoardStats } from "./overview-model";
import { useStarred } from "./use-starred";

export interface BoardCardData {
  id: string;
  name: string;
  stats: BoardStats;
  people: { name: string; avatarUrl: string | null }[];
  /** „termin 1 paź” — nearest upcoming deadline, shown when nothing is overdue. */
  dueLabel: string | null;
}

// dnd-kit swallows the click that ends a drag at document capture, but the
// native anchor still navigates — cancel that one click ourselves.
export function swallowNextClick() {
  const stop = (e: MouseEvent) => e.preventDefault();
  document.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 50);
}

export function BoardCard({ workspaceId, board, canDrag }: { workspaceId: string; board: BoardCardData; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id, disabled: !canDrag });
  const [starred, toggleStar] = useStarred();
  const href = `/w/${workspaceId}/b/${board.id}/table`;
  const on = isSaved(starred, { type: "board", id: board.id });
  const { done, total, overdue, share } = board.stats;

  return (
    <li
      ref={setNodeRef}
      data-ui="board-card"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      // dnd-kit turns the node into a focusable role="button"; that would break
      // the list semantics and swallow the card's link. Pointer drag stays,
      // keyboard reorder lives in the sidebar.
      role={undefined}
      tabIndex={undefined}
      className="group relative flex flex-col rounded-lg border border-border bg-card p-4 hover:border-n-300"
    >
      <Link
        href={href}
        prefetch={false}
        draggable={false}
        className="absolute inset-0 rounded-lg outline-none focus-visible:shadow-[var(--focus)]"
      >
        <span className="sr-only">{board.name}</span>
      </Link>

      <div className="pointer-events-none relative flex items-center gap-2">
        <IconBoards className={cn("shrink-0", on ? "text-orange-700" : "text-fg-3")} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{board.name}</span>
        <button
          type="button"
          aria-pressed={on}
          aria-label={on ? `Usuń gwiazdkę z tablicy ${board.name}` : `Oznacz gwiazdką tablicę ${board.name}`}
          onClick={() => toggleStar({ type: "board", id: board.id, label: board.name, href })}
          className="pointer-events-auto -mr-1 grid size-6 shrink-0 place-items-center rounded-sm outline-none hover:bg-n-100 focus-visible:shadow-[var(--focus)] active:bg-n-200"
        >
          {on ? (
            <IconStarFilled width={14} height={14} className="text-warning" />
          ) : (
            <IconStar width={14} height={14} className="text-n-400" />
          )}
        </button>
      </div>

      <div className="pointer-events-none relative mt-3 flex items-center gap-1.5">
        <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-n-100">
          <span
            className={cn("block h-full", progressTone(share) === "success" ? "bg-success" : "bg-info")}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      <div className="pointer-events-none relative mt-2.5 flex min-h-[22px] items-center">
        <AvatarStack people={board.people.map((p) => ({ name: p.name, src: p.avatarUrl }))} max={3} size={22} />
        {overdue > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-danger-text">
            <span aria-hidden className="size-[5px] rounded-full bg-danger" />
            {overdue} po terminie
          </span>
        ) : (
          board.dueLabel && <span className="ml-auto font-mono text-[10px] text-fg-3">{board.dueLabel}</span>
        )}
      </div>
    </li>
  );
}
