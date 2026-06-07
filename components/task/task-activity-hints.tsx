import { CheckSquare, FileText, Link2, MessageSquare } from "lucide-react";

function commentLabel(n: number): string {
  if (n === 1) return "komentarz";
  // Polish plural: 2-4 (and 22-24, etc.) → "komentarze"; else "komentarzy".
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "komentarze";
  return "komentarzy";
}

// Tiny badges hinting that the task has body content. Renders nothing when the
// task is "empty" so quiet rows stay quiet.
export function TaskActivityHints({
  hasDescription,
  commentCount,
  subtaskCount = 0,
  subtaskDoneCount = 0,
  linkedCount = 0,
}: {
  hasDescription: boolean;
  commentCount: number;
  // 0 means "no subtasks" → hint is hidden. Otherwise we render "done/total".
  subtaskCount?: number;
  subtaskDoneCount?: number;
  // Count of TaskLink rows where this task is source OR target.
  linkedCount?: number;
}) {
  if (!hasDescription && commentCount <= 0 && subtaskCount <= 0 && linkedCount <= 0) return null;
  const subtaskComplete = subtaskCount > 0 && subtaskDoneCount === subtaskCount;
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]">
      {hasDescription && (
        <span
          title="Zadanie zawiera opis"
          // Light/dark per-color palette tuned for contrast. Border + tinted
          // bg keeps the badges readable on both card and table row backgrounds.
          className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-1.5 py-0.5 font-semibold text-violet-700 dark:border-violet-400/40 dark:bg-violet-400/15 dark:text-violet-200"
        >
          <FileText size={10} aria-hidden /> Opis
        </span>
      )}
      {subtaskCount > 0 && (
        <span
          title={`${subtaskDoneCount} z ${subtaskCount} podzadań ukończone`}
          className={
            subtaskComplete
              ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200"
              : "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200"
          }
        >
          <CheckSquare size={10} aria-hidden /> {subtaskDoneCount}/{subtaskCount}
        </span>
      )}
      {commentCount > 0 && (
        <span
          title={`${commentCount} ${commentLabel(commentCount)}`}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-200"
        >
          <MessageSquare size={10} aria-hidden /> {commentCount}
        </span>
      )}
      {linkedCount > 0 && (
        <span
          title={
            linkedCount === 1
              ? "1 powiązane zadanie"
              : `${linkedCount} powiązanych zadań`
          }
          className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/15 px-1.5 py-0.5 font-semibold text-fuchsia-700 dark:border-fuchsia-400/40 dark:bg-fuchsia-400/15 dark:text-fuchsia-200"
        >
          <Link2 size={10} aria-hidden /> {linkedCount}
        </span>
      )}
    </div>
  );
}
