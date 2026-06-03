import { CheckSquare, FileText, MessageSquare } from "lucide-react";

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
}: {
  hasDescription: boolean;
  commentCount: number;
  // 0 means "no subtasks" → hint is hidden. Otherwise we render "done/total".
  subtaskCount?: number;
  subtaskDoneCount?: number;
}) {
  if (!hasDescription && commentCount <= 0 && subtaskCount <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/80">
      {hasDescription && (
        <span
          title="Zadanie zawiera opis"
          className="inline-flex items-center gap-1"
        >
          <FileText size={10} aria-hidden /> Opis
        </span>
      )}
      {subtaskCount > 0 && (
        <span
          title={`${subtaskDoneCount} z ${subtaskCount} podzadań ukończone`}
          className="inline-flex items-center gap-1"
        >
          <CheckSquare size={10} aria-hidden /> {subtaskDoneCount}/{subtaskCount}
        </span>
      )}
      {commentCount > 0 && (
        <span
          title={`${commentCount} ${commentLabel(commentCount)}`}
          className="inline-flex items-center gap-1"
        >
          <MessageSquare size={10} aria-hidden /> {commentCount}
        </span>
      )}
    </div>
  );
}
