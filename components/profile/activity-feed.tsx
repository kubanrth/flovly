import Link from "next/link";
import { IconBoards, IconComment, IconAttachment, IconFile, IconRecent, IconRoadmap, IconUsers } from "@/components/ui/icons";

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
  const size = { width: 13, height: 13 };
  if (action.includes("comment")) return <IconComment {...size} />;
  if (action.includes("attachment")) return <IconAttachment {...size} />;
  if (action.includes("member")) return <IconUsers {...size} />;
  switch (objectType.toLowerCase()) {
    case "task":
      return <IconFile {...size} />;
    case "board":
      return <IconBoards {...size} />;
    case "milestone":
      return <IconRoadmap {...size} />;
    default:
      return <IconRecent {...size} />;
  }
}

function actionAccent(action: string): string {
  if (action.endsWith(".create")) return "text-success-text";
  if (action.endsWith(".delete")) return "text-danger-text";
  if (action.endsWith(".update")) return "text-warning-text";
  return "text-fg-3";
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
      <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
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
                className={`relative z-10 grid size-5 place-items-center rounded-full bg-card ring-2 ring-background ${actionAccent(entry.action)}`}
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

            <div className="flex flex-1 flex-col gap-0.5 pb-3">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {actionLabel(entry.action)}
                </span>
                {href ? (
                  <Link
                    href={href}
                    className="rounded-[2px] font-mono text-xs text-link no-underline outline-none hover:text-orange-800 hover:underline"
                  >
                    #{entry.objectId.slice(-6).toUpperCase()}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-fg-3">
                    #{entry.objectId.slice(-6).toUpperCase()}
                  </span>
                )}
                <span className="text-2xs text-fg-3">· {entry.workspaceName}</span>
              </div>
              <span className="font-mono text-2xs text-fg-3">{relTime(entry.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
