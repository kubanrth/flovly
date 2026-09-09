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
    <aside className="flex w-[236px] shrink-0 flex-col gap-2 border-r border-border bg-canvas p-3 max-md:h-dvh max-md:w-[280px] max-md:bg-card">
      <button
        type="button"
        onClick={onNew}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card text-sm font-medium text-fg-2 transition-[border-color,color] hover:border-orange-400 hover:text-foreground"
      >
        <Plus size={14} />
        <span>Nowa</span>
      </button>

      {sessions.length === 0 ? (
        <p className="mt-1 px-1 text-xs leading-[1.5] text-fg-3">
          Brak rozmów. Zacznij pytaniem &mdash; Ateron odpowie.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
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
      className="group flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[13px] data-[active=true]:bg-orange-50"
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        <MessageSquare
          size={14}
          className="mt-0.5 shrink-0 text-fg-3 group-data-[active=true]:text-orange-700"
        />
        {/* Dwie linie zamiast ucinania — tytul rozmowy to cale pytanie i po
            obcieciu w polowie slowa rozmowy byly nie do odroznienia. */}
        <span className="line-clamp-2 min-w-0 leading-[1.35] text-foreground group-data-[active=true]:font-semibold">
          {session.title}
        </span>
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={onDelete}
          className="grid size-7 shrink-0 place-items-center rounded-md text-danger-text hover:bg-chip-red-bg"
          title="Tak, skasuj"
        >
          <Trash2 size={13} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
            setTimeout(() => setConfirming(false), 2000);
          }}
          className="grid size-7 shrink-0 place-items-center rounded-md text-transparent group-hover:text-fg-3 hover:bg-n-100 hover:text-danger-text"
          title="Skasuj"
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  );
}
