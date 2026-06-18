"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";
import { StatusPicker } from "@/components/table/status-picker";

export interface TaskListRow {
  id: string;
  title: string;
  workspaceId: string;
  // BoardId + boardStatusColumns + statusColumnId — inline
  // status picker w liście wymaga listy dostępnych statusów per board.
  boardId: string;
  statusColumnId: string | null;
  boardStatusColumns: { id: string; name: string; colorHex: string }[];
  workspaceName: string;
  boardName: string;
  // Legacy: zostaje na fallback gdy boardStatusColumns puste (rare).
  status: { name: string; colorHex: string } | null;
  tags: { id: string; name: string; colorHex: string }[];
  stopAt: string | null;
  assigneeIds: string[];
}

export interface TaskListSection {
  key: string;
  label: string;
  accent: "destructive" | "primary" | "muted" | "none";
  rows: TaskListRow[];
}

// Extension: wraps the My Tasks render in a hotkey-aware client
// component so hovering a row + pressing M opens the assign menu.
// Buckets / flat list mode handled by the `sections` structure.
export function HotkeyTaskList({
  members,
  sections,
  emptyState,
}: {
  members: AssignMember[];
  sections: TaskListSection[];
  emptyState: ReactNode;
}) {
  // The hook doesn't actually need a workspaceId to function — it's
  // passed through unchanged but toggleAssigneeAction infers workspace
  // from the task. Empty string is fine; the action does the lookup.
  const assign = useAssignHotkey({ members, workspaceId: "" });

  const anyRows = sections.some((s) => s.rows.length > 0);
  const visibleSections = sections.filter((s) => s.rows.length > 0);

  return (
    <>
      {anyRows ? (
        // v4 single card — rounded-[22px] glass surface z brand-tinted shadow.
        // Wszystkie grupy w jednej karcie, każda z own accent strip top-of-group.
        <div className="relative overflow-hidden rounded-[22px] border border-white/60 bg-white/55 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-2 px-4 py-4 md:px-5 md:py-5">
            {visibleSections.map((section, idx) => (
              <Section
                key={section.key}
                label={section.label}
                accent={section.accent}
                rows={section.rows}
                rowProps={assign.rowProps}
                isFirst={idx === 0}
              />
            ))}
          </div>
          <div className="border-t border-white/50 bg-white/30 px-5 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="font-mono text-[0.7rem] text-muted-foreground/80">
              Hint · zadania ze wszystkich tablic w jednym miejscu · kliknij aby otworzyć
            </span>
          </div>
        </div>
      ) : (
        emptyState
      )}
      {assign.menu}
    </>
  );
}

function Section({
  label,
  accent,
  rows,
  rowProps,
  isFirst,
}: {
  label: string;
  accent: TaskListSection["accent"];
  rows: TaskListRow[];
  rowProps: ReturnType<typeof useAssignHotkey>["rowProps"];
  isFirst: boolean;
}) {
  // v4 group accent — 3px strip top-of-group (gradient dla primary/destructive,
  // muted dla reszty). Eyebrow + count pill obok.
  const accentClass =
    accent === "destructive"
      ? "text-rose-500"
      : accent === "primary"
        ? "text-primary"
        : "text-muted-foreground";

  // 3px wide accent strip — używany jako separator między grupami.
  const stripClass =
    accent === "destructive"
      ? "bg-gradient-to-b from-rose-500 to-rose-400"
      : accent === "primary"
        ? "bg-brand-gradient"
        : "bg-muted-foreground/30";

  const header =
    accent === "none" ? null : (
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span
          aria-hidden
          className={`h-4 w-[3px] rounded-[2px] ${stripClass}`}
        />
        <h2 className={`text-[0.78rem] font-bold tracking-[-0.01em] ${accentClass}`}>
          {label}
        </h2>
        <span className="rounded-full bg-white/40 px-2 py-0.5 font-mono text-[0.66rem] text-muted-foreground dark:bg-white/[0.06]">
          {rows.length}
        </span>
      </div>
    );

  const list = (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.id}>
          <TaskRow row={row} {...rowProps(row.id, row.assigneeIds)} />
        </li>
      ))}
    </ul>
  );

  if (!header) return <>{list}</>;
  return (
    <section className={`flex flex-col gap-1 ${isFirst ? "" : "mt-3"}`}>
      {header}
      {list}
    </section>
  );
}

function TaskRow({
  row,
  onMouseEnter,
  onMouseLeave,
}: {
  row: TaskListRow;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  // Aktualny status w formacie StatusOption (id/name/colorHex).
  // null gdy task nie ma statusu → picker pokaże "— brak —".
  const current = row.statusColumnId
    ? row.boardStatusColumns.find((s) => s.id === row.statusColumnId) ?? null
    : null;

  // v4 row: displayId mono brand-light + title + status pill + due 12px (rose gdy overdue).
  // Card surface: rounded-[13px] glass, subtle border, hover lift.
  // Due 'shortId' fallback — wyciągamy 6 ostatnich znaków id jako proxy displayId.
  const displayId = `#${row.id.slice(-4).toUpperCase()}`;
  const overdue = row.stopAt !== null && new Date(row.stopAt) < new Date();

  return (
    // Dwie zmiany w tym wierszu:
    // 1) Link zawiera `?from=/my-tasks` żeby task detail wiedział że
    //    user przyszedł z My Tasks, nie z workspace overview — "Wróć"
    //    pójdzie z powrotem na listę (a nie na ogólny przegląd).
    // 2) StatusPicker NAD Link'iem (poza nim), żeby klik w picker nie
    //    nawigował do task'a. Zostawiamy hover-state na całym wierszu
    //    przez `<div className="group ...">`.
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="group flex items-center gap-3 rounded-[13px] border border-white/60 bg-white/70 px-3.5 py-3 transition-all hover:-translate-y-[1px] hover:border-primary/40 hover:bg-white hover:shadow-[0_8px_20px_-12px_rgba(122,51,236,0.25)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
    >
      <span className="shrink-0 font-mono text-[0.7rem] font-semibold text-brand-400">
        {displayId}
      </span>
      <Link
        href={`/w/${row.workspaceId}/t/${row.id}?from=${encodeURIComponent("/my-tasks")}`}
        className="min-w-0 flex-1 truncate text-[0.88rem] font-medium leading-tight tracking-[-0.005em] transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
      >
        {row.title}
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {row.boardStatusColumns.length > 0 ? (
          <StatusPicker
            taskId={row.id}
            workspaceId={row.workspaceId}
            boardId={row.boardId}
            current={current}
            options={row.boardStatusColumns}
            canEdit
            canManageBoard={false}
          />
        ) : (
          row.status && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold"
              style={{
                color: row.status.colorHex,
                background: `${row.status.colorHex}22`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: row.status.colorHex }}
              />
              {row.status.name}
            </span>
          )
        )}
        {row.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {row.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-medium"
                style={{ background: `${tag.colorHex}1A`, color: tag.colorHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tag.colorHex }}
                />
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {row.stopAt && (
          <span
            className={`w-16 shrink-0 text-right text-[0.75rem] font-medium ${
              overdue ? "text-rose-500" : "text-muted-foreground"
            }`}
          >
            {new Date(row.stopAt).toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
