"use client";

// F13: zawartość rozwiniętego wiersza Listy — checklista („Podzadania") i druga
// strona powiązań. Zadania podrzędne to osobne zadania i idą własnymi, wciętymi
// wierszami, więc tutaj ich nie ma. Wspólne dla tabeli (desktop) i kart (mobile).

import { startTransition, useState } from "react";
import Link from "next/link";
import { toggleSubtaskAction } from "@/app/(app)/w/[workspaceId]/t/subtask-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { BoardTableTask, LinkedTaskLine, SubtaskLine } from "@/components/table/types";

// Wysokość liczona z góry — wirtualizacja tabeli potrzebuje offsetów przed renderem.
export const DETAIL_LINE = 22;
const DETAIL_PAD = 34; // py-2 (16) + nagłówek h-4 z mb-0.5 (18)
export const hasDetail = (t: BoardTableTask) => t.subtasks.length > 0 || t.linked.length > 0;
export const detailHeight = (t: BoardTableTask) => DETAIL_PAD + Math.max(t.subtasks.length, t.linked.length) * DETAIL_LINE;

function Heading({ children, count }: { children: React.ReactNode; count: string }) {
  return (
    <p className="mb-0.5 flex h-4 items-center gap-1.5 text-2xs font-semibold uppercase tracking-[.06em] text-n-600">
      {children} <span className="font-mono font-normal">{count}</span>
    </p>
  );
}

export function SubtaskChecklist({ subtasks, canEdit, mobile }: { subtasks: SubtaskLine[]; canEdit: boolean; mobile?: boolean }) {
  const done = subtasks.filter((s) => s.completed).length;
  return (
    <div className={cn("min-w-0", !mobile && "max-w-[420px] flex-1")}>
      <Heading count={`${done}/${subtasks.length}`}>Podzadania</Heading>
      <ul>
        {subtasks.map((s) => <SubtaskRow key={s.id} sub={s} canEdit={canEdit} mobile={mobile} />)}
      </ul>
    </div>
  );
}

function SubtaskRow({ sub, canEdit, mobile }: { sub: SubtaskLine; canEdit: boolean; mobile?: boolean }) {
  // `toggleSubtaskAction` odświeża tylko stronę zadania, więc Lista trzyma stan
  // lokalnie; wartość z serwera wygrywa, gdy przyjdzie świeższa.
  const [seen, setSeen] = useState(sub.completed);
  const [done, setDone] = useState(sub.completed);
  if (sub.completed !== seen) { setSeen(sub.completed); setDone(sub.completed); }
  const toggle = () => {
    const next = !done;
    setDone(next);
    const fd = new FormData();
    fd.set("subtaskId", sub.id);
    fd.set("completed", String(next));
    startTransition(() => { void toggleSubtaskAction(fd); });
  };
  return (
    <li className={cn("flex items-center gap-2", mobile && "min-h-8")} style={mobile ? undefined : { height: DETAIL_LINE }}>
      <Checkbox size="sm" checked={done} disabled={!canEdit} ariaLabel={done ? `Odznacz: ${sub.title}` : `Zaznacz: ${sub.title}`} onCheckedChange={toggle} />
      <span className={cn("min-w-0 truncate", mobile ? "text-sm" : "text-xs", done ? "text-fg-3 line-through" : "text-foreground")}>{sub.title}</span>
    </li>
  );
}

export function LinkedTaskList({ linked, workspaceId, mobile }: { linked: LinkedTaskLine[]; workspaceId: string; mobile?: boolean }) {
  return (
    <div className={cn("min-w-0", !mobile && "max-w-[420px] flex-1")}>
      <Heading count={String(linked.length)}>Powiązane zadania</Heading>
      <ul>
        {linked.map((l) => (
          <li key={l.id} className={cn("flex items-center gap-2", mobile && "min-h-8")} style={mobile ? undefined : { height: DETAIL_LINE }}>
            <span className="w-9 shrink-0 font-mono text-2xs text-n-600">#{l.displayId}</span>
            <Link href={`/w/${workspaceId}/t/${l.id}`} className={cn("min-w-0 truncate text-foreground hover:underline", mobile ? "text-sm" : "text-xs")}>
              {l.title}
            </Link>
            {l.otherBoard && <span className="shrink-0 text-2xs text-fg-3">inna tablica</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
