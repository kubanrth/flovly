// Pure helpers used by both server components and the client-side
// ViewSwitcher. Kept in a non-"use client" file so server callers can
// invoke them directly — Next.js refuses to call exports from a
// "use client" module server-side.

export type ViewName =
  | "table"
  | "kanban"
  | "roadmap"
  | "gantt"
  | "whiteboard"
  // F12-K73: Task Line — workflow zadań po prawej + sidebar po lewej.
  | "taskline"
  // F12-K78: Calendar — miesięczny widok zadań po startAt/stopAt.
  | "calendar";

export const ALL_VIEWS: ViewName[] = [
  "table",
  "kanban",
  "roadmap",
  "gantt",
  "calendar",
  "whiteboard",
  "taskline",
];

// Maps the Prisma `ViewType` enum (uppercase) onto the lowercase ViewName
// used in URLs and in Workspace.enabledViews JSON.
export function viewTypeToName(type: string): ViewName | null {
  switch (type.toUpperCase()) {
    case "TABLE":
      return "table";
    case "KANBAN":
      return "kanban";
    case "ROADMAP":
      return "roadmap";
    case "GANTT":
      return "gantt";
    case "WHITEBOARD":
      return "whiteboard";
    case "TASKLINE":
      return "taskline";
    case "CALENDAR":
      return "calendar";
    default:
      return null;
  }
}

// Parse Workspace.enabledViews (Json) into typed ViewName[]. Falls back
// to all views when the field is missing / malformed.
export function parseEnabledViews(raw: unknown): ViewName[] {
  if (!Array.isArray(raw)) return ALL_VIEWS;
  const out: ViewName[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = viewTypeToName(entry);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.length > 0 ? out : ALL_VIEWS;
}

// Per-board enabled views = intersection of workspace-level
// `enabledViews` with the BoardView `type`s this board has default rows
// for (name IS NULL). Boards that predate this system (zero BoardView
// rows) fall back to the workspace set so nothing disappears on them.
export function computeBoardEnabledViews(
  workspaceEnabled: ViewName[],
  defaultBoardViewTypes: string[],
): ViewName[] {
  if (defaultBoardViewTypes.length === 0) return workspaceEnabled;
  const boardSet = new Set<ViewName>();
  for (const t of defaultBoardViewTypes) {
    const name = viewTypeToName(t);
    if (name) boardSet.add(name);
  }
  return workspaceEnabled.filter((v) => boardSet.has(v));
}
