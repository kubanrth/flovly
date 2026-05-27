import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendEmail } from "@/lib/email";
import { broadcastUserChange } from "@/lib/realtime";
import { escapeHtml } from "@/lib/html-escape";

// Walk a ProseMirror doc and collect every `mention` node's attrs.id.
// Dedupes by id; ignores entries with non-string ids so a corrupt node
// can't blow the whole create/update.
export function extractMentionIds(doc: unknown): string[] {
  const ids = new Set<string>();
  const queue: unknown[] = [doc];
  while (queue.length) {
    const node = queue.shift() as { type?: unknown; attrs?: { id?: unknown }; content?: unknown[] };
    if (node?.type === "mention" && typeof node?.attrs?.id === "string") {
      ids.add(node.attrs.id);
    }
    if (Array.isArray(node?.content)) queue.push(...node.content);
  }
  return [...ids];
}

// Pull a short plain-text snippet from a ProseMirror doc for notification UI
// and email previews. Flattens to ~140 chars.
export function extractPlainSnippet(doc: unknown, maxLen = 140): string {
  const parts: string[] = [];
  const queue: unknown[] = [doc];
  while (queue.length) {
    const node = queue.shift() as { type?: unknown; text?: unknown; attrs?: { label?: unknown }; content?: unknown[] };
    if (node?.type === "text" && typeof node.text === "string") parts.push(node.text);
    else if (node?.type === "mention" && typeof node?.attrs?.label === "string") parts.push(`@${node.attrs.label}`);
    if (Array.isArray(node?.content)) queue.push(...node.content);
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > maxLen ? joined.slice(0, maxLen - 1) + "…" : joined;
}

// Sync a comment's mentions: keep only the ids in `newIds` that are actual
// workspace members, write CommentMention rows (idempotent), emit a
// Notification per newly-added id and fire a best-effort email. Returns
// the set of ids that were freshly added (used by the caller's audit diff).
export async function syncCommentMentions(params: {
  commentId: string;
  authorId: string;
  taskId: string;
  workspaceId: string;
  newIds: string[];
  bodyDoc?: unknown;
}): Promise<{ added: string[]; removed: string[] }> {
  const { commentId, authorId, taskId, workspaceId, newIds, bodyDoc } = params;

  // Only notify workspace members (filters out stale ids from deleted
  // members, or bogus ids from a doctored client payload).
  const memberships = newIds.length
    ? await db.workspaceMembership.findMany({
        where: {
          workspaceId,
          userId: { in: newIds },
          workspace: { deletedAt: null },
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      })
    : [];
  const valid = new Map(memberships.map((m) => [m.user.id, m.user]));
  const validIds = new Set(valid.keys());

  const existing = await db.commentMention.findMany({
    where: { commentId },
    select: { mentionedUserId: true },
  });
  const existingIds = new Set(existing.map((r) => r.mentionedUserId));

  const toAdd = [...validIds].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !validIds.has(id));

  if (toRemove.length > 0) {
    await db.commentMention.deleteMany({
      where: { commentId, mentionedUserId: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await db.commentMention.createMany({
      data: toAdd.map((mentionedUserId) => ({ commentId, mentionedUserId })),
    });
  }

  // Only notify users who are newly mentioned AND aren't the author.
  const notifyIds = toAdd.filter((id) => id !== authorId);
  if (notifyIds.length > 0) {
    const [author, task] = await Promise.all([
      db.user.findUnique({ where: { id: authorId }, select: { name: true, email: true } }),
      db.task.findUnique({
        where: { id: taskId },
        select: { title: true, workspaceId: true, workspace: { select: { name: true } } },
      }),
    ]);
    const authorName = author?.name ?? author?.email ?? "Ktoś";
    const taskTitle = task?.title ?? "zadanie";
    const workspaceName = task?.workspace.name ?? "workspace";

    const snippet = bodyDoc ? extractPlainSnippet(bodyDoc) : "";
    const payload = {
      commentId,
      taskId,
      workspaceId,
      authorId,
      authorName,
      taskTitle,
      snippet,
    } as const;

    // Per-user create żeby dostać id'ki — broadcast wysyła id, klient
    // dofetchuje szczegóły.
    const created = await Promise.all(
      notifyIds.map((userId) =>
        db.notification.create({
          data: {
            userId,
            type: "comment.mention",
            payload: payload as unknown as Prisma.InputJsonValue,
          },
          select: { id: true, userId: true },
        }),
      ),
    );
    await Promise.all(
      created.map((n) =>
        broadcastUserChange(n.userId, { kind: "notification.new", id: n.id }),
      ),
    );

    // Email — best-effort; we await to flush before returning but never throw.
    const taskUrl = `/w/${workspaceId}/t/${taskId}`;
    await Promise.all(
      notifyIds.map(async (userId) => {
        const user = valid.get(userId);
        if (!user?.email) return;
        try {
          await sendEmail({
            to: user.email,
            subject: `${authorName} oznaczył(a) Cię w komentarzu — ${taskTitle}`,
            html: mentionEmailHtml({
              recipientName: user.name ?? user.email.split("@")[0],
              authorName,
              workspaceName,
              taskTitle,
              taskUrl,
            }),
          });
        } catch {
          /* swallow — in-app notification already persisted */
        }
      }),
    );
  }

  return { added: toAdd, removed: toRemove };
}

function mentionEmailHtml(args: {
  recipientName: string;
  authorName: string;
  workspaceName: string;
  taskTitle: string;
  taskUrl: string;
}): string {
  const appUrl = process.env.APP_URL || "";
  const fullUrl = appUrl ? `${appUrl}${args.taskUrl}` : args.taskUrl;
  return `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:560px;margin:24px auto;padding:0 16px;">
  <p>Cześć ${escapeHtml(args.recipientName)},</p>
  <p><strong>${escapeHtml(args.authorName)}</strong> oznaczył(a) Cię w komentarzu do zadania
     <strong>${escapeHtml(args.taskTitle)}</strong> w przestrzeni <em>${escapeHtml(args.workspaceName)}</em>.</p>
  <p><a href="${fullUrl}" style="display:inline-block;padding:10px 18px;background:#7B68EE;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Otwórz zadanie</a></p>
  <p style="color:#666;font-size:12px;margin-top:24px;">FLOVLY</p>
</body></html>`.trim();
}

