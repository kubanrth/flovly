// Serializer dla dziennego workspace backup'u. Server-only.
// Backup = wszystkie workspace-scoped tabele (DB metadata).
// NIE backupowane: pliki w Supabase Storage (Attachment metadata zostaje,
// fizyczne bajty nie), user-scoped data (Notification, Todo*, Note*,
// PersonalReminder).

import { db } from "@/lib/db";

export interface WorkspaceBackupPayload {
  version: 1;
  workspaceId: string;
  workspaceName: string;
  dayKey: string;
  createdAt: string;
  data: WorkspaceBackupData;
  counts: Record<string, number>;
}

// `unknown[]` zamiast Prisma typów — payload to JSON dump i konsumenci
// (admin UI / future restore) i tak parsują przy odczycie.
export interface WorkspaceBackupData {
  workspace: unknown;
  memberships: unknown[];
  invitations: unknown[];
  tags: unknown[];
  auditLogs: unknown[];

  boards: unknown[];
  boardMemberships: unknown[];
  boardViews: unknown[];
  statusColumns: unknown[];
  tableColumns: unknown[];
  boardLinks: unknown[];
  linkFolders: unknown[];
  linkFolderColumns: unknown[];
  linkFolderRows: unknown[];
  linkFolderCellValues: unknown[];

  tasks: unknown[];
  taskAssignees: unknown[];
  taskCustomValues: unknown[];
  taskTags: unknown[];
  subtasks: unknown[];
  attachments: unknown[];
  comments: unknown[];
  commentMentions: unknown[];
  taskPolls: unknown[];
  taskPollOptions: unknown[];
  taskPollVotes: unknown[];

  milestones: unknown[];

  canvases: unknown[];
  processNodes: unknown[];
  processEdges: unknown[];
  processStrokes: unknown[];
  processNodeTaskLinks: unknown[];

  creativeBriefs: unknown[];
  supportTickets: unknown[];
  supportTicketAttachments: unknown[];
  workspaceEvents: unknown[];
  wikiPage: unknown;
}

// YYYY-MM-DD w strefie Europe/Warsaw (sv-SE locale daje ISO date bez czasu).
export function polishDayKey(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Wszystkie zapytania scope'owane do workspaceId (bezpośrednio albo
// przez parent FK IN [...]). NIE filtrujemy po deletedAt — backup
// zachowuje usunięte rekordy (audit-friendly).
export async function buildWorkspaceBackup(
  workspaceId: string,
): Promise<WorkspaceBackupPayload> {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found.`);
  }

  // Bulk fetch: workspace-scoped tables direct, child tables (komentarze,
  // ProcessNode) via parent FK IN [...]. Parent ID list first, then leaves.

  const [
    memberships,
    invitations,
    tags,
    auditLogs,
    boards,
    tasks,
    milestones,
    canvases,
    creativeBriefs,
    supportTickets,
    workspaceEvents,
    wikiPage,
  ] = await Promise.all([
    db.workspaceMembership.findMany({ where: { workspaceId } }),
    db.invitation.findMany({ where: { workspaceId } }),
    db.tag.findMany({ where: { workspaceId } }),
    db.auditLog.findMany({ where: { workspaceId } }),
    db.board.findMany({ where: { workspaceId } }),
    db.task.findMany({ where: { workspaceId } }),
    db.milestone.findMany({ where: { workspaceId } }),
    db.processCanvas.findMany({ where: { workspaceId } }),
    db.creativeBrief.findMany({ where: { workspaceId } }),
    db.supportTicket.findMany({ where: { workspaceId } }),
    db.workspaceEvent.findMany({ where: { workspaceId } }),
    db.wikiPage.findUnique({ where: { workspaceId } }),
  ]);

  const boardIds = boards.map((b) => b.id);
  const taskIds = tasks.map((t) => t.id);
  const canvasIds = canvases.map((c) => c.id);
  const supportTicketIds = supportTickets.map((s) => s.id);

  const [
    boardMemberships,
    boardViews,
    statusColumns,
    tableColumns,
    boardLinks,
    linkFolders,
    taskAssignees,
    taskCustomValues,
    taskTags,
    subtasks,
    attachments,
    comments,
    taskPolls,
    processNodes,
    processEdges,
    processStrokes,
    processNodeTaskLinks,
    supportTicketAttachments,
  ] = await Promise.all([
    db.boardMembership.findMany({ where: { boardId: { in: boardIds } } }),
    db.boardView.findMany({ where: { boardId: { in: boardIds } } }),
    db.statusColumn.findMany({ where: { boardId: { in: boardIds } } }),
    db.tableColumn.findMany({ where: { boardId: { in: boardIds } } }),
    db.boardLink.findMany({ where: { boardId: { in: boardIds } } }),
    db.linkFolder.findMany({ where: { boardId: { in: boardIds } } }),
    db.taskAssignee.findMany({ where: { taskId: { in: taskIds } } }),
    db.taskCustomValue.findMany({ where: { taskId: { in: taskIds } } }),
    db.taskTag.findMany({ where: { taskId: { in: taskIds } } }),
    db.subtask.findMany({ where: { taskId: { in: taskIds } } }),
    db.attachment.findMany({ where: { taskId: { in: taskIds } } }),
    db.comment.findMany({ where: { taskId: { in: taskIds } } }),
    db.taskPoll.findMany({ where: { taskId: { in: taskIds } } }),
    db.processNode.findMany({ where: { canvasId: { in: canvasIds } } }),
    db.processEdge.findMany({ where: { canvasId: { in: canvasIds } } }),
    db.processStroke.findMany({ where: { canvasId: { in: canvasIds } } }),
    db.processNodeTaskLink.findMany({
      where: { node: { canvasId: { in: canvasIds } } },
    }),
    db.supportTicketAttachment.findMany({
      where: { ticketId: { in: supportTicketIds } },
    }),
  ]);

  const linkFolderIds = linkFolders.map((f) => f.id);
  const commentIds = comments.map((c) => c.id);
  const pollIds = taskPolls.map((p) => p.id);

  const [
    linkFolderColumns,
    linkFolderRows,
    linkFolderCellValues,
    commentMentions,
    taskPollOptions,
    taskPollVotes,
  ] = await Promise.all([
    db.linkFolderColumn.findMany({ where: { folderId: { in: linkFolderIds } } }),
    db.linkFolderRow.findMany({ where: { folderId: { in: linkFolderIds } } }),
    db.linkFolderCellValue.findMany({
      where: { row: { folderId: { in: linkFolderIds } } },
    }),
    db.commentMention.findMany({ where: { commentId: { in: commentIds } } }),
    db.taskPollOption.findMany({ where: { pollId: { in: pollIds } } }),
    db.taskPollVote.findMany({ where: { pollId: { in: pollIds } } }),
  ]);

  const data: WorkspaceBackupData = {
    workspace,
    memberships,
    invitations,
    tags,
    auditLogs,

    boards,
    boardMemberships,
    boardViews,
    statusColumns,
    tableColumns,
    boardLinks,
    linkFolders,
    linkFolderColumns,
    linkFolderRows,
    linkFolderCellValues,

    tasks,
    taskAssignees,
    taskCustomValues,
    taskTags,
    subtasks,
    attachments,
    comments,
    commentMentions,
    taskPolls,
    taskPollOptions,
    taskPollVotes,

    milestones,

    canvases,
    processNodes,
    processEdges,
    processStrokes,
    processNodeTaskLinks,

    creativeBriefs,
    supportTickets,
    supportTicketAttachments,
    workspaceEvents,
    wikiPage,
  };

  const counts: Record<string, number> = {
    memberships: memberships.length,
    invitations: invitations.length,
    tags: tags.length,
    auditLogs: auditLogs.length,
    boards: boards.length,
    boardMemberships: boardMemberships.length,
    boardViews: boardViews.length,
    statusColumns: statusColumns.length,
    tableColumns: tableColumns.length,
    boardLinks: boardLinks.length,
    linkFolders: linkFolders.length,
    linkFolderColumns: linkFolderColumns.length,
    linkFolderRows: linkFolderRows.length,
    linkFolderCellValues: linkFolderCellValues.length,
    tasks: tasks.length,
    taskAssignees: taskAssignees.length,
    taskCustomValues: taskCustomValues.length,
    taskTags: taskTags.length,
    subtasks: subtasks.length,
    attachments: attachments.length,
    comments: comments.length,
    commentMentions: commentMentions.length,
    taskPolls: taskPolls.length,
    taskPollOptions: taskPollOptions.length,
    taskPollVotes: taskPollVotes.length,
    milestones: milestones.length,
    canvases: canvases.length,
    processNodes: processNodes.length,
    processEdges: processEdges.length,
    processStrokes: processStrokes.length,
    processNodeTaskLinks: processNodeTaskLinks.length,
    creativeBriefs: creativeBriefs.length,
    supportTickets: supportTickets.length,
    supportTicketAttachments: supportTicketAttachments.length,
    workspaceEvents: workspaceEvents.length,
    wikiPage: wikiPage ? 1 : 0,
  };

  return {
    version: 1,
    workspaceId,
    workspaceName: workspace.name,
    dayKey: polishDayKey(new Date()),
    createdAt: new Date().toISOString(),
    data,
    counts,
  };
}
