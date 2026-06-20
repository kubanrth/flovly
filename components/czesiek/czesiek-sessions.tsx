"use client";

import { useState } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import type { ChatSessionSummary } from "./czesiek-types";

// F12-K74: lewy mini-sidebar w panelu chat — lista sesji + "Nowa".
// Aktywna sesja podświetlona. Hover na sesji pokazuje X (delete).
export function CzesiekSessions({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: ChatSessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex w-[180px] shrink-0 flex-col gap-1.5 border-r border-border bg-card/40 p-2 max-md:w-[260px] max-md:bg-card max-md:h-dvh">
      <button
        type="button"
        onClick={onNew}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-background font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground transition-all hover:border-primary/60 hover:text-foreground"
      >
        <Plus size={11} />
        <span>Nowa</span>
      </button>

      {sessions.length === 0 ? (
        <p className="mt-2 px-2 text-[0.72rem] leading-[1.45] text-muted-foreground/70">
          Brak rozmów. Zacznij pytaniem &mdash; Ateron odpowie.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto pt-1">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={() => onSelect(s.id)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: ChatSessionSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      data-active={active ? "true" : "false"}
      className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.78rem] data-[active=true]:bg-primary/10"
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-1.5 text-left"
      >
        <MessageSquare
          size={11}
          className="shrink-0 text-muted-foreground group-data-[active=true]:text-primary"
        />
        <span className="truncate text-foreground group-data-[active=true]:font-semibold">
          {session.title}
        </span>
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={onDelete}
          className="grid h-5 w-5 place-items-center rounded text-rose-500 hover:bg-rose-500/10"
          title="Tak, skasuj"
        >
          <Trash2 size={10} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
            setTimeout(() => setConfirming(false), 2000);
          }}
          className="grid h-5 w-5 place-items-center rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-accent hover:text-rose-500"
          title="Skasuj"
        >
          <Trash2 size={10} />
        </button>
      )}
    </li>
  );
}
