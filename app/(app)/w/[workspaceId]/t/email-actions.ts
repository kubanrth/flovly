"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { downloadAttachmentBuffer } from "@/lib/storage";
import { escapeHtml as escape } from "@/lib/html-escape";
import { writeAudit } from "@/lib/audit";
import { checkLimit } from "@/lib/rate-limit";

const schema = z.object({
  taskId: z.string().min(1),
  recipientEmail: z.string().email(),
  note: z.string().max(2000).optional(),
  // Comma-separated attachment IDs to include (empty = none).
  attachmentIds: z.string().optional(),
});

export type SendEmailState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

// Resend hard cap: 40 MB total attachments. Overflow falls back to signed-URL list.
const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;

function renderTaskHtml(task: {
  title: string;
  description: string | null;
  statusName: string | null;
  statusColor: string;
  startAt: Date | null;
  stopAt: Date | null;
  assignees: string[];
  note: string | null;
  attachmentLinks: { filename: string; url: string }[];
  senderName: string;
}): string {
  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const rows = [
    ["Status", task.statusName ?? "—"],
    ["Start", fmt(task.startAt)],
    ["Koniec", fmt(task.stopAt)],
    ["Osoby", task.assignees.length > 0 ? task.assignees.join(", ") : "—"],
  ];

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8" /></head>
<body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0F172A;background:#F8FAFC;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #E2E8F0">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748B">Zadanie z FLOVLY</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2">${escape(task.title)}</h1>
      <div style="margin-top:8px"><span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${task.statusColor}22;color:${task.statusColor};font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase">${escape(task.statusName ?? "brak statusu")}</span></div>
    </div>
    ${task.note ? `<div style="padding:16px 24px;background:#F8FAFC;border-bottom:1px solid #E2E8F0">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748B;margin-bottom:4px">Od: ${escape(task.senderName)}</div>
      <div style="white-space:pre-wrap;line-height:1.55">${escape(task.note)}</div>
    </div>` : ""}
    <table role="presentation" style="width:100%;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:10px 24px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748B;width:110px">${escape(k)}</td><td style="padding:10px 24px 10px 0">${escape(v)}</td></tr>`).join("")}
    </table>
    ${task.description ? `<div style="padding:16px 24px;border-top:1px solid #E2E8F0"><div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748B;margin-bottom:8px">Opis</div><div style="line-height:1.6">${task.description}</div></div>` : ""}
    ${task.attachmentLinks.length > 0 ? `<div style="padding:16px 24px;border-top:1px solid #E2E8F0"><div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748B;margin-bottom:8px">Za duże do załącznika</div>${task.attachmentLinks.map((a) => `<div style="margin:4px 0"><a href="${a.url}" style="color:#7B68EE">${escape(a.filename)}</a></div>`).join("")}</div>` : ""}
  </div>
</body></html>`;
}

// Minimal ProseMirror → HTML renderer for email bodies. Handles paragraph,
// text, bullet/ordered list, heading, bold/italic/code. Unknown nodes are
// dropped silently.
function prosemirrorToHtml(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as { type?: string; content?: unknown[]; text?: string; marks?: { type: string }[]; attrs?: { level?: number } };
  if (node.type === "text") {
    let t = escape(node.text ?? "");
    for (const m of node.marks ?? []) {
      if (m.type === "bold") t = `<strong>${t}</strong>`;
      else if (m.type === "italic") t = `<em>${t}</em>`;
      else if (m.type === "code") t = `<code>${t}</code>`;
    }
    return t;
  }
  const children = (node.content ?? []).map(prosemirrorToHtml).join("");
  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p style="margin:0 0 10px">${children}</p>`;
    case "heading":
      return `<h${node.attrs?.level ?? 2} style="margin:12px 0 6px">${children}</h${node.attrs?.level ?? 2}>`;
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList":
      return `<ol>${children}</ol>`;
    case "listItem":
      return `<li>${children}</li>`;
    case "hardBreak":
      return "<br/>";
    default:
      return children;
  }
}

export async function sendTaskByEmailAction(
  _prev: SendEmailState,
  formData: FormData,
): Promise<SendEmailState> {
  const parsed = schema.safeParse({
    taskId: formData.get("taskId"),
    recipientEmail: formData.get("recipientEmail"),
    note: formData.get("note") || undefined,
    attachmentIds: formData.get("attachmentIds") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Sprawdź adres email odbiorcy." };
  }

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    include: {
      workspace: { select: { id: true } },
      statusColumn: { select: { name: true, colorHex: true } },
      assignees: {
        include: { user: { select: { name: true, email: true } } },
      },
      attachments: { where: { deletedAt: null } },
    },
  });
  if (!task) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.sendEmail");

  // Rate-limit so we can't be turned into a spam relay.
  const rate = await checkLimit("task.sendEmail", ctx.userId);
  if (!rate.ok) {
    return { ok: false, error: rate.error };
  }

  const selectedIds = new Set(
    (parsed.data.attachmentIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const selected = task.attachments.filter((a) => selectedIds.has(a.id));

  const attachments: EmailAttachment[] = [];
  const overflowLinks: { filename: string; url: string }[] = [];
  let totalBytes = 0;
  for (const a of selected) {
    if (totalBytes + a.sizeBytes > MAX_ATTACHMENT_BYTES) {
      const { createSignedDownloadUrl } = await import("@/lib/storage");
      const url = await createSignedDownloadUrl(a.storageKey).catch(() => null);
      if (url) overflowLinks.push({ filename: a.filename, url });
      continue;
    }
    try {
      const buf = await downloadAttachmentBuffer(a.storageKey);
      attachments.push({ filename: a.filename, content: buf });
      totalBytes += a.sizeBytes;
    } catch {
      // Fall back to a signed link (expires per SIGNED_DOWNLOAD_TTL_SECONDS, 15m).
      const { createSignedDownloadUrl } = await import("@/lib/storage");
      const url = await createSignedDownloadUrl(a.storageKey).catch(() => null);
      if (url) overflowLinks.push({ filename: a.filename, url });
    }
  }

  const senderUser = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, email: true },
  });

  const html = renderTaskHtml({
    title: task.title,
    description: task.descriptionJson
      ? prosemirrorToHtml(task.descriptionJson)
      : null,
    statusName: task.statusColumn?.name ?? null,
    statusColor: task.statusColumn?.colorHex ?? "#64748B",
    startAt: task.startAt,
    stopAt: task.stopAt,
    assignees: task.assignees.map((a) => a.user.name ?? a.user.email),
    note: parsed.data.note ?? null,
    attachmentLinks: overflowLinks,
    senderName: senderUser?.name ?? senderUser?.email ?? "Ktoś z FLOVLY",
  });

  const result = await sendEmail({
    to: parsed.data.recipientEmail,
    subject: `Zadanie: ${task.title}`,
    html,
    attachments,
    replyTo: senderUser?.email,
  });

  if (!result.sent) {
    return {
      ok: false,
      error:
        result.skipped === "no-api-key"
          ? "Wysyłka nieskonfigurowana (brak RESEND_API_KEY)."
          : result.error ?? "Nie udało się wysłać.",
    };
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.emailSent",
    diff: {
      to: parsed.data.recipientEmail,
      attachments: attachments.length,
      overflow: overflowLinks.length,
    },
  });

  return {
    ok: true,
    message:
      overflowLinks.length > 0
        ? `Wysłano. ${overflowLinks.length} plik(ów) dołączono jako link (za duży rozmiar).`
        : "Wysłano.",
  };
}
