import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership, userCanAccessBoard } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { createSignedDownloadUrl, isImageMime } from "@/lib/storage";
import type { TaskDetailProps } from "@/components/task/task-detail";
import type { RichTextDoc } from "@/components/task/rich-text-editor";

// Map an absolute reminderAt back to the preset offset the select shows.
// Snaps within ±5 minutes tolerance to allow for clock skew on writes.
function inferReminderOffset(stopAt: Date | null, reminderAt: Date | null): string | null {
  if (!stopAt || !reminderAt) return null;
  const diffMs = stopAt.getTime() - reminderAt.getTime();
  const hours = diffMs / (60 * 60 * 1000);
  const PRESETS: [number, string][] = [[1, "1h"], [4, "4h"], [24, "1d"], [72, "3d"]];
  for (const [h, label] of PRESETS) {
    if (Math.abs(hours - h) < 0.1) return label;
  }
  return null;
}

// Task.descriptionJson legacy shape was `{ plain: "text" }`; now holds
// ProseMirror doc JSON. Convert legacy on read; invalid collapses to null.
function normalizeDescription(raw: unknown): RichTextDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { type?: unknown; plain?: unknown };
  if (obj.type === "doc") return raw as RichTextDoc;
  if (typeof obj.plain === "string" && obj.plain.length > 0) {
    return {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: obj.plain }] },
      ],
    };
  }
  return null;
}

// Shared data loader for the task detail view (reused by standalone
// /w/[workspaceId]/t/[taskId] page AND the intercepting modal route).
export async function fetchTaskDetail(
  workspaceId: string,
  taskId: string,
): Promise<TaskDetailProps> {
  const ctx = await requireWorkspaceMembership(workspaceId);

  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    include: {
      board: {
        include: {
          statusColumns: { orderBy: { order: "asc" } },
          milestones: {
            where: { deletedAt: null },
            orderBy: [{ orderIndex: "asc" }, { startAt: "asc" }],
            select: { id: true, title: true, startAt: true, stopAt: true },
          },
          customColumns: { orderBy: { order: "asc" } },
        },
      },
      assignees: { select: { userId: true } },
      tags: { select: { tagId: true } },
      subtasks: { orderBy: { order: "asc" } },
      customValues: true,
      // F12-K63: both directions of TaskLink — UI merges them into a single
      // "Powiązane" section so the relationship reads symmetrically.
      linksOut: {
        include: {
          target: {
            select: {
              id: true,
              title: true,
              displayId: true,
              deletedAt: true,
              assignees: {
                take: 1,
                include: {
                  user: {
                    select: { id: true, name: true, email: true, avatarUrl: true },
                  },
                },
              },
            },
          },
        },
      },
      linksIn: {
        include: {
          source: {
            select: {
              id: true,
              title: true,
              displayId: true,
              deletedAt: true,
              assignees: {
                take: 1,
                include: {
                  user: {
                    select: { id: true, name: true, email: true, avatarUrl: true },
                  },
                },
              },
            },
          },
        },
      },
      poll: {
        include: {
          options: { orderBy: { order: "asc" } },
          votes: true,
        },
      },
    },
  });
  if (!task) notFound();

  // Gate by per-board access — workspace MEMBER who knows a task ID on
  // a PRIVATE board could otherwise still load the task page.
  if (!(await userCanAccessBoard(task.boardId, ctx.userId, ctx.role))) notFound();

  const [members, tags, comments, auditEntries, attachmentRows, candidateRows, workspaceBoardRows, workspaceContactRows] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.tag.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }], // workspace-local + global
      },
      orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    }),
    db.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.auditLog.findMany({
      where: { workspaceId, objectType: "Task", objectId: taskId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.attachment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    // Picker candidate pool — capped at 500 most-recently-updated so the
    // workspace overview doesn't slow down. Excludes self + soft-deleted.
    db.task.findMany({
      where: { workspaceId, deletedAt: null, id: { not: taskId } },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, title: true, displayId: true },
    }),
    // Lista tablic w workspace dla MoveTaskMenu w nagłówku karty. Order
    // ten sam co na overview workspace'u żeby user wiedział co gdzie jest.
    db.board.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        workspace: { select: { name: true } },
      },
    }),
    // Pool wszystkich aktywnych kontaktów w workspace dla ContactField w
    // task-detail. Cap 1000 — workspace'y z setkami klientów zachowują
    // responsywność, dropdown i tak jest searchable po stronie browsera.
    db.contact.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 1000,
      select: {
        id: true,
        companyName: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ]);

  // Pre-sign image thumbnails so browser renders them without round-trip.
  // Non-image URLs minted on demand — don't waste signatures on files
  // that aren't rendered inline.
  const attachmentPayload = await Promise.all(
    attachmentRows.map(async (a) => {
      const thumbnailUrl = isImageMime(a.mimeType)
        ? await createSignedDownloadUrl(a.storageKey).catch(() => null)
        : null;
      return {
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        uploader: a.uploader,
        createdAt: a.createdAt.toISOString(),
        isUploader: a.uploaderId === ctx.userId,
        thumbnailUrl,
      };
    }),
  );

  // Merge outgoing + incoming links so the section reads symmetrically. Skip
  // any link whose other end is soft-deleted so dead rows don't show up.
  const linkedTasks = [
    ...task.linksOut
      .filter((l) => !l.target.deletedAt)
      .map((l) => {
        const a = l.target.assignees[0]?.user ?? null;
        return {
          linkId: l.id,
          task: {
            id: l.target.id,
            title: l.target.title,
            displayId: l.target.displayId,
            primaryAssignee: a,
          },
        };
      }),
    ...task.linksIn
      .filter((l) => !l.source.deletedAt)
      .map((l) => {
        const a = l.source.assignees[0]?.user ?? null;
        return {
          linkId: l.id,
          task: {
            id: l.source.id,
            title: l.source.title,
            displayId: l.source.displayId,
            primaryAssignee: a,
          },
        };
      }),
  ];

  return {
    workspaceId,
    role: ctx.role,
    task: {
      id: task.id,
      displayId: task.displayId,
      title: task.title,
      descriptionJson: normalizeDescription(task.descriptionJson),
      statusColumnId: task.statusColumnId,
      priority: task.priority,
      milestoneId: task.milestoneId,
      startAt: task.startAt ? task.startAt.toISOString() : null,
      stopAt: task.stopAt ? task.stopAt.toISOString() : null,
      reminderAt: task.reminderAt ? task.reminderAt.toISOString() : null,
      reminderOffset: inferReminderOffset(task.stopAt, task.reminderAt),
      recurrenceRule:
        task.recurrenceRule && typeof task.recurrenceRule === "object"
          ? (task.recurrenceRule as {
              freq: "daily" | "weekly" | "monthly";
              day?: number;
            })
          : null,
      recurrenceParentId: task.recurrenceParentId,
      timeTrackedSeconds: task.timeTrackedSeconds,
      timerStartedAt: task.timerStartedAt
        ? task.timerStartedAt.toISOString()
        : null,
      timerCompletedAt: task.timerCompletedAt
        ? task.timerCompletedAt.toISOString()
        : null,
    },
    milestones: task.board.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      startAt: m.startAt.toISOString(),
      stopAt: m.stopAt.toISOString(),
    })),
    statusColumns: task.board.statusColumns.map((c) => ({
      id: c.id,
      name: c.name,
      colorHex: c.colorHex,
    })),
    allMembers: members.map((m) => m.user),
    assigneeIds: new Set(task.assignees.map((a) => a.userId)),
    allTags: tags.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
    tagIds: new Set(task.tags.map((t) => t.tagId)),
    canEdit: can(ctx.role, "task.update"),
    canDelete: can(ctx.role, "task.delete"),
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author,
      bodyJson: (c.bodyJson as RichTextDoc | null) ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      isAuthor: c.authorId === ctx.userId,
    })),
    canComment: can(ctx.role, "task.comment"),
    canModerateComments: ctx.role === "ADMIN",
    currentUserId: ctx.userId,
    activity: auditEntries.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor,
      diff: (e.diff ?? null) as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    })),
    attachments: attachmentPayload,
    canUpload: can(ctx.role, "task.upload"),
    canModerateAttachments: ctx.role === "ADMIN",
    subtasks: task.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
    })),
    canManageSubtasks: can(ctx.role, "subtask.manage"),
    poll: task.poll
      ? {
          id: task.poll.id,
          question: task.poll.question,
          authorId: task.poll.authorId,
          closedAt: task.poll.closedAt ? task.poll.closedAt.toISOString() : null,
          options: task.poll.options.map((o) => {
            const count = task.poll!.votes.filter((v) => v.optionId === o.id).length;
            return { id: o.id, label: o.label, voteCount: count };
          }),
          totalVotes: task.poll.votes.length,
          myVoteOptionId:
            task.poll.votes.find((v) => v.userId === ctx.userId)?.optionId ?? null,
        }
      : null,
    canManagePoll: can(ctx.role, "poll.manage"),
    canVote: can(ctx.role, "poll.vote"),
    customColumns: task.board.customColumns.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as import("@/lib/table-fields").FieldType,
      options: c.options as unknown,
    })),
    customValues: Object.fromEntries(
      task.customValues.map((v) => [v.columnId, v.valueText ?? ""]),
    ),
    linkedTasks,
    linkCandidates: candidateRows.map((c) => ({
      id: c.id,
      title: c.title,
      displayId: c.displayId,
    })),
    boardId: task.boardId,
    workspaceBoards: workspaceBoardRows.map((b) => ({
      id: b.id,
      name: b.name,
      workspaceName: b.workspace.name,
    })),
    contactId: task.contactId,
    workspaceContacts: workspaceContactRows.map((c) => {
      // Label = firma + osoba w nawiasie, fallback na email albo "(bez nazwy)"
      // gdy kontakt to czysty placeholder.
      const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
      // Pierwszeństwo: companyName → osoba → email → placeholder.
      const labelBase =
        c.companyName ?? (person !== "" ? person : (c.email ?? "(bez nazwy)"));
      const suffix =
        c.companyName && person ? ` · ${person}` : "";
      return { id: c.id, label: `${labelBase}${suffix}` };
    }),
  };
}
