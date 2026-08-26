import { IconAttachment, IconComment, IconDoc, IconLink, IconTodo } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { BoardTableTask } from "@/components/table/types";

// Tiny „there's more inside” hints next to the title (B1: ☑2/5 💬3 📎1). Null when quiet.
export function RowHints({ task, className }: { task: Pick<BoardTableTask, "hasDescription" | "commentCount" | "subtaskCount" | "subtaskDoneCount" | "linkedCount" | "attachments">; className?: string }) {
  const items: { key: string; icon: React.ReactNode; text?: string; title: string }[] = [];
  if (task.subtaskCount > 0) items.push({ key: "sub", icon: <IconTodo />, text: `${task.subtaskDoneCount}/${task.subtaskCount}`, title: `${task.subtaskDoneCount} z ${task.subtaskCount} podzadań` });
  if (task.commentCount > 0) items.push({ key: "com", icon: <IconComment />, text: String(task.commentCount), title: `Komentarze: ${task.commentCount}` });
  if (task.attachments.length > 0) items.push({ key: "att", icon: <IconAttachment />, text: String(task.attachments.length), title: `Załączniki: ${task.attachments.length}` });
  if (task.linkedCount > 0) items.push({ key: "lnk", icon: <IconLink />, text: String(task.linkedCount), title: `Powiązane: ${task.linkedCount}` });
  if (task.hasDescription) items.push({ key: "desc", icon: <IconDoc />, title: "Zadanie ma opis" });
  if (items.length === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-2xs leading-none text-fg-3 [&_svg]:size-[11px]", className)} data-ui="row-hints">
      {items.map((i) => (
        <span key={i.key} title={i.title} className="inline-flex items-center gap-0.5">
          {i.icon}
          {i.text}
        </span>
      ))}
    </span>
  );
}
