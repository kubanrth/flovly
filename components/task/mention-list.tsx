"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MentionMember { id: string; name: string | null; email: string; avatarUrl: string | null }
interface MentionListProps { items: MentionMember[]; command: (item: { id: string; label: string }) => void }
export interface MentionListHandle { onKeyDown: (p: { event: KeyboardEvent }) => boolean }

// Tiptap @mention suggestion popup — popover surface, 32px rows, avatar 20.
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);
  const run = (index: number) => { const item = items[index]; if (item) command({ id: item.id, label: item.name ?? item.email.split("@")[0]! }); };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === "ArrowUp") { setSelected((s) => (s - 1 + items.length) % items.length); return true; }
      if (event.key === "Enter") { run(selected); return true; }
      return false;
    },
  }));

  if (items.length === 0) return <div className="mention-popover popover-surface px-3 py-2 text-xs text-n-500">Brak dopasowań</div>;
  return (
    <div className="mention-popover popover-surface flex min-w-[220px] flex-col p-1" role="listbox">
      {items.map((m, i) => {
        const label = m.name ?? m.email.split("@")[0]!;
        return (
          <button key={m.id} type="button" role="option" aria-selected={i === selected} onMouseDown={(e) => { e.preventDefault(); run(i); }} onMouseEnter={() => setSelected(i)}
            className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none", i === selected && "bg-n-100")}>
            <Avatar name={label} src={m.avatarUrl} size={20} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="shrink-0 font-mono text-[10px] text-n-500">{m.email.split("@")[0]}</span>
          </button>
        );
      })}
    </div>
  );
});
