"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Link2, Search, X } from "lucide-react";
import {
  linkTasksAction,
  unlinkTasksAction,
} from "@/app/(app)/w/[workspaceId]/t/task-link-actions";
import type {
  LinkCandidate,
  LinkedTaskItem,
} from "@/components/task/task-detail";

export function LinkedTasksSection({
  workspaceId,
  taskId,
  linkedTasks,
  candidates,
  canEdit,
}: {
  workspaceId: string;
  taskId: string;
  linkedTasks: LinkedTaskItem[];
  candidates: LinkCandidate[];
  canEdit: boolean;
}) {
  const linkedIds = useMemo(
    () => new Set(linkedTasks.map((l) => l.task.id)),
    [linkedTasks],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow inline-flex items-center gap-1.5">
          <Link2 size={11} /> Powiązane zadania
          {linkedTasks.length > 0 && (
            <span className="font-mono text-[0.66rem] text-muted-foreground">
              · {linkedTasks.length}
            </span>
          )}
        </span>
      </div>

      {linkedTasks.length === 0 ? (
        <p className="text-[0.86rem] text-muted-foreground/80">
          Brak powiązanych zadań.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {linkedTasks.map((l) => (
            <LinkedRow
              key={l.linkId}
              workspaceId={workspaceId}
              item={l}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <LinkPicker
          workspaceId={workspaceId}
          taskId={taskId}
          candidates={candidates}
          alreadyLinked={linkedIds}
        />
      )}
    </section>
  );
}

function LinkedRow({
  workspaceId,
  item,
  canEdit,
}: {
  workspaceId: string;
  item: LinkedTaskItem;
  canEdit: boolean;
}) {
  const a = item.task.primaryAssignee;
  const assigneeLabel = a ? (a.name ?? a.email) : null;
  return (
    <li className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      {a ? (
        <span
          title={assigneeLabel ?? undefined}
          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
        >
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (a.name ?? a.email).slice(0, 2).toUpperCase()
          )}
        </span>
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-[0.55rem] uppercase text-muted-foreground">
          —
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
          {item.task.title}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
          #{item.task.displayId}
          {assigneeLabel && (
            <>
              <span>·</span>
              <span className="truncate">{assigneeLabel}</span>
            </>
          )}
        </span>
      </div>

      <Link
        href={`/w/${workspaceId}/t/${item.task.id}`}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        Przejdź <ArrowRight size={10} />
      </Link>

      {canEdit && (
        <form
          action={(fd) => startTransition(() => unlinkTasksAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="linkId" value={item.linkId} />
          <button
            type="submit"
            aria-label="Odlinkuj"
            title="Odlinkuj"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X size={12} />
          </button>
        </form>
      )}
    </li>
  );
}

function LinkPicker({
  workspaceId,
  taskId,
  candidates,
  alreadyLinked,
}: {
  workspaceId: string;
  taskId: string;
  candidates: LinkCandidate[];
  alreadyLinked: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = candidates.filter((c) => !alreadyLinked.has(c.id));
    if (!q) return pool.slice(0, 50);
    const matches = pool.filter((c) => {
      const t = c.title.toLowerCase();
      const id = `#${c.displayId}`;
      return t.includes(q) || id.includes(q);
    });
    return matches.slice(0, 50);
  }, [candidates, alreadyLinked, query]);

  const submitLink = (targetTaskId: string) => {
    const fd = new FormData();
    fd.set("sourceTaskId", taskId);
    fd.set("targetTaskId", targetTaskId);
    startTransition(() => {
      void linkTasksAction(fd).then(() => {
        setOpen(false);
        setQuery("");
      });
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Fuchsia mirror "Powiązane" badge'a w TaskActivityHints — żeby cały
        // mechanizm linkowania (badge + przycisk + sekcja) miał spójny kolor.
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 font-sans text-[0.95rem] font-semibold text-fuchsia-700 shadow-[0_1px_2px_rgba(217,70,239,0.08)] transition-colors hover:border-fuchsia-500/50 hover:bg-fuchsia-500/15 dark:border-fuchsia-400/40 dark:bg-fuchsia-400/10 dark:text-fuchsia-200 dark:hover:bg-fuchsia-400/15"
      >
        <Link2 size={14} /> Powiąż zadanie
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="szukaj po tytule albo #ID…"
            className="h-9 w-full rounded-md border border-border bg-background pl-7 pr-3 text-[0.88rem] outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-2 py-3 text-center text-[0.82rem] text-muted-foreground">
          {query.trim()
            ? "Brak dopasowań."
            : "Brak dostępnych zadań do powiązania."}
        </p>
      ) : (
        <ul className="flex max-h-[280px] flex-col overflow-y-auto rounded-md border border-border bg-background">
          {filtered.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => submitLink(c.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/60"
              >
                <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                  #{c.displayId}
                </span>
                <span className="line-clamp-1 flex-1 text-[0.88rem]">
                  {c.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
