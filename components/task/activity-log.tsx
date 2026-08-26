import { plPlural } from "@/lib/pluralize";
import { formatWhen } from "@/components/task/format";
import { IconAttachment, IconComment, IconEdit, IconPlus, IconTag, IconTime, IconTrash, IconUsers, IconCheck } from "@/components/ui/icons";

export interface ActivityEntry {
  id: string;
  action: string;
  actor: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

// "Historia" tab — AuditLog timeline (B2: 24px icon tile, 12px n-600 text, mono stamp).
export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return <p className="text-xs text-n-500">Brak wpisów.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e) => <li key={e.id}><ActivityRow entry={e} /></li>)}
    </ol>
  );
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const actorName = entry.actor?.name ?? entry.actor?.email.split("@")[0] ?? "System";
  return (
    <div className="flex gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-n-100 text-n-500" aria-hidden>{iconFor(entry.action)}</span>
      <p className="min-w-0 flex-1 text-xs leading-[19px] text-n-600">
        <span className="font-semibold text-foreground">{actorName}</span> {summarize(entry.action, entry.diff)}{" "}
        <span className="font-mono text-[10px] text-n-500">· {formatWhen(entry.createdAt)}</span>
      </p>
    </div>
  );
}

function iconFor(action: string) {
  const p = { width: 13, height: 13 };
  if (action === "task.created") return <IconPlus {...p} />;
  if (action === "task.deleted" || action === "comment.deleted") return <IconTrash {...p} />;
  if (action.startsWith("task.assignee")) return <IconUsers {...p} />;
  if (action.startsWith("task.tag")) return <IconTag {...p} />;
  if (action.startsWith("comment.")) return <IconComment {...p} />;
  if (action.startsWith("attachment.")) return <IconAttachment {...p} />;
  if (action.startsWith("task.timer")) return <IconTime {...p} />;
  if (action === "task.updated" || action === "task.patched") return <IconEdit {...p} />;
  return <IconCheck {...p} />;
}

function summarize(action: string, diff: Record<string, unknown> | null): string {
  switch (action) {
    case "task.created": return "utworzył(a) zadanie";
    case "task.deleted": return "usunął(-ęła) zadanie";
    case "task.updated": return "zaktualizował(a) zadanie";
    case "task.patched": {
      const keys = diff ? Object.keys(diff) : [];
      return keys.length === 0 ? "zmodyfikował(a) zadanie" : `zmienił(a) ${keys.map((k) => FIELD_LABELS[k] ?? k).join(", ")}`;
    }
    case "task.assigneeAdded": return "przypisał(a) osobę do zadania";
    case "task.assigneeRemoved": return "odpiął(-ęła) osobę od zadania";
    case "task.tagAdded": return "dodał(a) tag";
    case "task.tagRemoved": return "usunął(-ęła) tag";
    case "comment.created": {
      const mentions = (diff?.mentions as string[] | undefined) ?? [];
      return mentions.length > 0 ? `dodał(a) komentarz i oznaczył(a) ${mentions.length} ${plPlural(mentions.length, "osobę", "osoby", "osób")}` : "dodał(a) komentarz";
    }
    case "comment.updated": {
      const added = (diff?.mentionsAdded as string[] | undefined) ?? [];
      const removed = (diff?.mentionsRemoved as string[] | undefined) ?? [];
      return added.length + removed.length === 0 ? "edytował(a) komentarz" : `edytował(a) komentarz (wzmianki: +${added.length}/−${removed.length})`;
    }
    case "comment.deleted": return "usunął(-ęła) komentarz";
    default: return ACTION_LABELS[action] ?? action;
  }
}

const ACTION_LABELS: Record<string, string> = {
  "task.descriptionUpdated": "zaktualizował(a) opis", "task.priority": "zmienił(a) priorytet", "task.moved": "przeniósł(-osła) zadanie na inną tablicę",
  "task.emailSent": "wysłał(a) zadanie mailem", "task.recurrenceUpdated": "zmienił(a) cykliczność", "task.milestoneAssigned": "zmienił(a) milestone",
  "milestone.linked": "przypiął(-ęła) milestone", "milestone.unlinked": "odpiął(-ęła) milestone",
  "task.timerStarted": "uruchomił(a) timer", "task.timerPaused": "zatrzymał(a) timer", "task.timerCompleted": "zakończył(a) timer",
  "attachment.created": "dodał(a) załącznik", "attachment.deleted": "usunął(-ęła) załącznik",
  "subtask.created": "dodał(a) podzadanie", "subtask.deleted": "usunął(-ęła) podzadanie",
  "poll.created": "utworzył(a) głosowanie", "poll.closed": "zamknął(-ęła) głosowanie",
  "taskLink.created": "powiązał(a) zadanie", "taskLink.deleted": "usunął(-ęła) powiązanie",
};

const FIELD_LABELS: Record<string, string> = {
  title: "tytuł", statusColumnId: "status", startAt: "datę startu", stopAt: "datę końca", rowOrder: "kolejność",
  reminderOffset: "przypomnienie", contactId: "kontakt", priority: "priorytet",
};
