"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { toggleAssigneeAction } from "@/app/(app)/w/[workspaceId]/t/actions";

export interface AssignMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

// Global `M` hotkey on hovered task rows pops an assign menu.
// Use this hook in any list view (BoardTable, KanbanBoard, My Tasks…):
// 1. call `rowProps(taskId, alreadyAssignedUserIds)` and spread onto the
//    row element to make it "hoverable" for the hotkey
// 2. render `<menu>` at the end of the view — it's a fixed-position
//    popover so it works even if the row is scrolled
export function useAssignHotkey({
  members,
  workspaceId,
}: {
  members: AssignMember[];
  workspaceId: string;
}) {
  const [hovered, setHovered] = useState<{
    taskId: string;
    assignedIds: Set<string>;
  } | null>(null);
  const [openAt, setOpenAt] = useState<{
    x: number;
    y: number;
    taskId: string;
    assignedIds: Set<string>;
  } | null>(null);
  const cursor = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursor.current.x = e.clientX;
      cursor.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Bail out if user is typing somewhere — don't hijack `M` while they
  // write task titles, notes, etc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (!hovered) return;
      e.preventDefault();
      setOpenAt({
        x: cursor.current.x,
        y: cursor.current.y,
        taskId: hovered.taskId,
        assignedIds: hovered.assignedIds,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovered]);

  const rowProps = useCallback(
    (taskId: string, assignedIds: Iterable<string> = []) => ({
      onMouseEnter: () =>
        setHovered({ taskId, assignedIds: new Set(assignedIds) }),
      onMouseLeave: () => setHovered(null),
    }),
    [],
  );

  const close = useCallback(() => setOpenAt(null), []);

  const menu = openAt ? (
    <AssignMenu
      workspaceId={workspaceId}
      members={members}
      at={openAt}
      onClose={close}
    />
  ) : null;

  return { rowProps, menu };
}

function AssignMenu({
  members,
  at,
  onClose,
  workspaceId: _workspaceId,
}: {
  members: AssignMember[];
  at: { x: number; y: number; taskId: string; assignedIds: Set<string> };
  onClose: () => void;
  workspaceId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      members
        .filter((m) => {
          if (!q) return true;
          const n = (m.name ?? "").toLowerCase();
          return n.includes(q) || m.email.toLowerCase().includes(q);
        })
        .slice(0, 12),
    [members, q],
  );

  // Clamp left ≥ 8 so the popup never starts off the left edge on small viewports
  // (otherwise the popup pokes outside the viewport and triggers a horizontal
  // scrollbar on the body — what the user calls "rozciąga ekran"). Width 260
  // capped via maxWidth so very long names can't expand the popup past viewport.
  const POPUP_W = 260;
  const SAFE = 8;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(
      SAFE,
      Math.min(at.x, Math.max(SAFE, window.innerWidth - POPUP_W - SAFE)),
    ),
    top: Math.max(
      SAFE,
      Math.min(at.y + 12, Math.max(SAFE, window.innerHeight - 320)),
    ),
    zIndex: 100,
    width: POPUP_W,
    maxWidth: `calc(100vw - ${SAFE * 2}px)`,
  };

  return (
    <div
      ref={rootRef}
      style={style}
      className="overflow-hidden rounded-lg border border-border bg-popover p-2 shadow-[0_16px_40px_-16px_rgba(10,10,40,0.35)]"
    >
      <div className="mb-2 flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
        <Search size={12} className="text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Przypisz osobę…"
          className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <ul className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-2 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            Brak dopasowań
          </li>
        )}
        {filtered.map((m) => {
          const active = at.assignedIds.has(m.id);
          return (
            <li key={m.id}>
              <form
                action={(fd) =>
                  startTransition(async () => {
                    await toggleAssigneeAction(fd);
                    // Realtime broadcast can fail silently — force
                    // a router refresh so the hovered list view picks up
                    // the new assignee even when the channel doesn't fire.
                    router.refresh();
                    onClose();
                  })
                }
                className="m-0"
              >
                <input type="hidden" name="taskId" value={at.taskId} />
                <input type="hidden" name="userId" value={m.id} />
                <button
                  type="submit"
                  data-active={active ? "true" : "false"}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.84rem] transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.name ?? m.email).slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate">{m.name ?? m.email.split("@")[0]}</span>
                    {m.name && (
                      <span className="truncate font-mono text-[0.62rem] text-muted-foreground/80">
                        {m.email}
                      </span>
                    )}
                  </span>
                  {active && (
                    <UserPlus size={11} className="shrink-0 text-primary" />
                  )}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-border pt-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground/80">
        ESC — zamknij · klik — przełącz przypisanie
      </div>
    </div>
  );
}
