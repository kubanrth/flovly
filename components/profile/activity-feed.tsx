import Link from "next/link";
import { Activity, FileText, KanbanSquare, Layers, MessageCircle, Paperclip, UserPlus } from "lucide-react";

// F12-K98: account activity feed na /profile. Render entries z AuditLog
// filtrowane po actorId === currentUser. Polymorphic — różne objectType
// dostaje różne ikony + label. Pure render, fetch w page.tsx parent.

export interface ActivityFeedEntry {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  objectType: string;
  objectId: string;
  action: string;
  createdAt: Date;
}

// Action → human-readable Polish label.
const ACTION_LABELS: Record<string, string> = {
  "task.create": "Utworzył zadanie",
  "task.update": "Zaktualizował zadanie",
  "task.delete": "Usunął zadanie",
  "task.move": "Przeniósł zadanie",
  "task.assign": "Zmienił przypisanie",
  "task.comment": "Dodał komentarz",
  "task.attachment": "Dodał załącznik",
  "task.subtask": "Zmienił podzadanie",
  "board.create": "Utworzył tablicę",
  "board.update": "Zaktualizował tablicę",
  "board.delete": "Usunął tablicę",
  "workspace.update": "Zaktualizował przestrzeń",
  "workspace.member.add": "Dodał członka",
  "workspace.member.remove": "Usunął członka",
  "milestone.create": "Utworzył milestone",
  "milestone.update": "Zaktualizował milestone",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function actionIcon(objectType: string, action: string) {
  if (action.includes("comment")) return <MessageCircle size={14} />;
  if (action.includes("attachment")) return <Paperclip size={14} />;
  if (action.includes("member")) return <UserPlus size={14} />;
  switch (objectType.toLowerCase()) {
    case "task":
      return <FileText size={14} />;
    case "board":
      return <KanbanSquare size={14} />;
    case "milestone":
      return <Layers size={14} />;
    default:
      return <Activity size={14} />;
  }
}

function actionAccent(action: string): string {
  if (action.endsWith(".create")) return "text-emerald-500";
  if (action.endsWith(".delete")) return "text-rose-500";
  if (action.endsWith(".update")) return "text-amber-500";
  return "text-primary";
}

// Object link — gdy mamy Task lub Board, kierujemy na konkretny widok.
function objectHref(entry: ActivityFeedEntry): string | null {
  switch (entry.objectType.toLowerCase()) {
    case "task":
      return `/w/${entry.workspaceId}/t/${entry.objectId}`;
    case "board":
      return `/w/${entry.workspaceId}/b/${entry.objectId}/table`;
    case "workspace":
      return `/w/${entry.workspaceId}`;
    default:
      return null;
  }
}

function relTime(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "przed chwilą";
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h temu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dni temu`;
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: diff > 31536000 ? "numeric" : undefined,
  });
}

export function ActivityFeed({ entries }: { entries: ActivityFeedEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-[0.86rem] text-muted-foreground/80">
        Brak aktywności do wyświetlenia.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-0.5">
      {entries.map((entry, idx) => {
        const href = objectHref(entry);
        const isLast = idx === entries.length - 1;
        return (
          <li key={entry.id} className="group relative flex gap-3">
            {/* Vertical timeline rail + dot anchor */}
            <div className="relative flex w-5 shrink-0 flex-col items-center">
              <span
                className={`relative z-10 grid h-5 w-5 place-items-center rounded-full bg-card ring-2 ring-background ${actionAccent(entry.action)}`}
              >
                {actionIcon(entry.objectType, entry.action)}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-5 h-[calc(100%-12px)] w-px -translate-x-1/2 bg-border"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-0.5 pb-4">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-[0.86rem] font-medium text-foreground">
                  {actionLabel(entry.action)}
                </span>
                {href ? (
                  <Link
                    href={href}
                    className="font-mono text-[0.72rem] text-primary/80 transition-colors hover:text-primary"
                  >
                    #{entry.objectId.slice(-6).toUpperCase()}
                  </Link>
                ) : (
                  <span className="font-mono text-[0.72rem] text-muted-foreground/60">
                    #{entry.objectId.slice(-6).toUpperCase()}
                  </span>
                )}
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                  · {entry.workspaceName}
                </span>
              </div>
              <span className="font-mono text-[0.68rem] text-muted-foreground/70">
                {relTime(entry.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
