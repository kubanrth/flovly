import type { Role } from "@/lib/generated/prisma/enums";

export type Action =
  | "workspace.delete"
  | "workspace.updateSettings"
  | "workspace.inviteMember"
  | "workspace.removeMember"
  | "workspace.changeRole"
  | "board.create"
  | "board.delete"
  | "board.update"
  | "board.view"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assignUsers"
  | "task.comment"
  | "task.upload"
  | "milestone.create"
  | "milestone.update"
  | "milestone.delete"
  | "canvas.create"
  | "canvas.edit"
  | "canvas.delete"
  | "tag.manage"
  | "background.customize"
  | "subtask.manage"
  | "poll.manage"
  | "poll.vote"
  | "task.sendEmail"
  | "boardLink.manage"
  | "reminder.manage"
  | "wiki.read"
  | "wiki.edit"
  | "integrations.manage"
  | "board.manageMembers"
  | "board.share"
  | "contact.read"
  | "contact.create"
  | "contact.update"
  | "contact.delete"
  | "deal.read"
  | "deal.create"
  | "deal.update"
  | "deal.delete"
  | "dealStage.manage";

const MATRIX: Record<Role, Set<Action>> = {
  ADMIN: new Set<Action>([
    "workspace.delete",
    "workspace.updateSettings",
    "workspace.inviteMember",
    "workspace.removeMember",
    "workspace.changeRole",
    "board.create",
    "board.delete",
    "board.update",
    "board.view",
    "task.create",
    "task.update",
    "task.delete",
    "task.assignUsers",
    "task.comment",
    "task.upload",
    "task.sendEmail",
    "milestone.create",
    "milestone.update",
    "milestone.delete",
    "canvas.create",
    "canvas.edit",
    "canvas.delete",
    "tag.manage",
    "background.customize",
    "subtask.manage",
    "poll.manage",
    "poll.vote",
    "boardLink.manage",
    "reminder.manage",
    "wiki.read",
    "wiki.edit",
    "integrations.manage",
    "board.manageMembers",
    "board.share",
    "contact.read",
    "contact.create",
    "contact.update",
    "contact.delete",
    "deal.read",
    "deal.create",
    "deal.update",
    "deal.delete",
    "dealStage.manage",
  ]),
  MEMBER: new Set<Action>([
    "board.create",
    "board.update",
    "board.view",
    "task.create",
    "task.update",
    "task.delete",
    "task.assignUsers",
    "task.comment",
    "task.upload",
    "task.sendEmail",
    "milestone.create",
    "milestone.update",
    "milestone.delete",
    "canvas.create",
    "canvas.edit",
    "tag.manage",
    "background.customize",
    "subtask.manage",
    "poll.manage",
    "poll.vote",
    "boardLink.manage",
    "board.share",
    "reminder.manage",
    "wiki.read",
    "wiki.edit",
    "contact.read",
    "contact.create",
    "contact.update",
    "contact.delete",
    "deal.read",
    "deal.create",
    "deal.update",
    "deal.delete",
    "dealStage.manage",
  ]),
  VIEWER: new Set<Action>([
    "board.view",
    "task.comment",
    "poll.vote",
    "wiki.read",
    "contact.read",
    "deal.read",
  ]),
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].has(action);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(action);
}
