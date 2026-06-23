"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export interface MentionMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface MentionListProps {
  items: MentionMember[];
  command: (item: { id: string; label: string }) => void;
}

export interface MentionListHandle {
  onKeyDown: (p: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    const run = (index: number) => {
      const item = items[index];
      if (!item) return;
      command({ id: item.id, label: item.name ?? item.email.split("@")[0] });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          run(selected);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="mention-popover rounded-md border border-border bg-popover px-3 py-2 text-[0.82rem] text-muted-foreground shadow-lg">
          Brak dopasowań
        </div>
      );
    }

    return (
      <div className="mention-popover flex min-w-[220px] flex-col gap-0.5 rounded-md border border-border bg-popover p-1 shadow-lg">
        {items.map((m, i) => {
          const label = m.name ?? m.email.split("@")[0];
          const initials = (m.name ?? m.email).slice(0, 2).toUpperCase();
          return (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent editor from losing focus before the command fires.
                e.preventDefault();
                run(i);
              }}
              onMouseEnter={() => setSelected(i)}
              data-active={i === selected ? "true" : "false"}
              className="group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.86rem] text-foreground transition-colors data-[active=true]:bg-accent"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.58rem] font-bold text-white">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" width={24} height={24} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="shrink-0 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                {m.email.split("@")[0]}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
