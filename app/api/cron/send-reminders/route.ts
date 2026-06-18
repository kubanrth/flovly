import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isCronAuthorized } from "@/lib/cron-auth";
import { escapeHtml as escape } from "@/lib/html-escape";

// Vercel Cron hits this every 15 minutes (see vercel.json).
// Bearer token gate via isCronAuthorized.
async function runSweep(now: Date) {
  const due = await db.task.findMany({
    where: {
      reminderAt: { lte: now, not: null },
      reminderSentAt: null,
      stopAt: { gt: now },
      deletedAt: null,
    },
    take: 200,
    include: {
      workspace: { select: { id: true, name: true } },
      assignees: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  const appBase = process.env.APP_BASE_URL || "";
  let sent = 0;
  const failures: string[] = [];

  for (const task of due) {
    for (const a of task.assignees) {
      const taskUrl = appBase
        ? `${appBase}/w/${task.workspaceId}/t/${task.id}`
        : `/w/${task.workspaceId}/t/${task.id}`;
      const dueText =
        task.stopAt?.toLocaleString("pl-PL", {
          dateStyle: "medium",
          timeStyle: "short",
        }) ?? "";
      const html = `<!doctype html><html lang="pl"><body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0F172A;padding:24px">
        <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
          <div style="padding:20px 24px">
            <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7C5CFF">Przypomnienie</div>
            <h1 style="margin:6px 0 12px;font-size:20px;line-height:1.25">${escape(task.title)}</h1>
            <p style="margin:0 0 6px;color:#475569;line-height:1.55">Zadanie z przestrzeni <strong>${escape(task.workspace.name)}</strong> ma termin ${escape(dueText)}.</p>
            <a href="${taskUrl}" style="display:inline-block;margin-top:14px;padding:10px 18px;background:linear-gradient(140deg,#7C5CFF,#D247B5);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Otwórz zadanie</a>
          </div>
        </div>
      </body></html>`;

      const r = await sendEmail({
        to: a.user.email,
        subject: `⏰ Termin: ${task.title}`,
        html,
      });
      if (r.sent) sent++;
      else failures.push(`${a.user.email}: ${r.error ?? r.skipped ?? "unknown"}`);
    }
    await db.task.update({
      where: { id: task.id },
      data: { reminderSentAt: now },
    });
  }

  // Same sweep dla private TodoItem reminders — recipient = owner.
  const todoDue = await db.todoItem.findMany({
    where: {
      reminderAt: { lte: now, not: null },
      reminderSentAt: null,
    },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  for (const item of todoDue) {
    const url = appBase
      ? `${appBase}/my/todo?itemId=${item.id}`
      : `/my/todo?itemId=${item.id}`;
    const when = item.reminderAt?.toLocaleString("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
    }) ?? "";
    const html = `<!doctype html><html lang="pl"><body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0F172A;padding:24px">
      <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
        <div style="padding:20px 24px">
          <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7C5CFF">Przypomnienie · TO DO</div>
          <h1 style="margin:6px 0 12px;font-size:20px;line-height:1.25">${escape(item.content)}</h1>
          <p style="margin:0 0 6px;color:#475569;line-height:1.55">Prywatne zadanie z TO DO — ustawione na <strong>${escape(when)}</strong>.</p>
          <a href="${url}" style="display:inline-block;margin-top:14px;padding:10px 18px;background:linear-gradient(140deg,#7C5CFF,#D247B5);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Otwórz zadanie</a>
        </div>
      </div>
    </body></html>`;
    const r = await sendEmail({
      to: item.user.email,
      subject: `⏰ TO DO: ${item.content}`,
      html,
    });
    if (r.sent) sent++;
    else failures.push(`${item.user.email}: ${r.error ?? r.skipped ?? "unknown"}`);
    await db.todoItem.update({
      where: { id: item.id },
      data: { reminderSentAt: now },
    });
  }

  // F12-K66: deal reminders. Recipient = owner; creator as fallback gdy brak.
  const dealDue = await db.deal.findMany({
    where: {
      reminderAt: { lte: now, not: null },
      reminderSentAt: null,
      deletedAt: null,
    },
    take: 200,
    include: {
      owner: { select: { id: true, email: true, name: true } },
      creator: { select: { id: true, email: true, name: true } },
      stage: { select: { name: true } },
      workspace: { select: { id: true, name: true } },
    },
  });

  for (const deal of dealDue) {
    const recipient = deal.owner ?? deal.creator;
    const url = appBase
      ? `${appBase}/w/${deal.workspaceId}/sales/${deal.id}`
      : `/w/${deal.workspaceId}/sales/${deal.id}`;
    const when = deal.reminderAt?.toLocaleString("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
    }) ?? "";
    const valueLine =
      deal.valueAmount != null
        ? `<p style="margin:0 0 6px;color:#475569;line-height:1.55">Wartość: <strong>${deal.valueAmount} ${escape(deal.valueCurrency)}</strong> · Etap: <strong>${escape(deal.stage.name)}</strong></p>`
        : `<p style="margin:0 0 6px;color:#475569;line-height:1.55">Etap: <strong>${escape(deal.stage.name)}</strong></p>`;
    // F12-K71: custom treść przypomnienia jako blockquote. Newline'y w
    // notatce konwertujemy na <br> żeby user mógł rozbić zdania.
    const noteBlock = deal.reminderNote
      ? `<blockquote style="margin:14px 0 4px;padding:10px 14px;border-left:3px solid #7C5CFF;background:#F8F7FF;border-radius:0 8px 8px 0;color:#1F1A4D;font-size:14px;line-height:1.55;white-space:pre-wrap">${escape(deal.reminderNote).replace(/\n/g, "<br>")}</blockquote>`
      : "";
    const html = `<!doctype html><html lang="pl"><body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0F172A;padding:24px">
      <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
        <div style="padding:20px 24px">
          <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7C5CFF">Przypomnienie · Plan sprzedaży</div>
          <h1 style="margin:6px 0 12px;font-size:20px;line-height:1.25">${escape(deal.title)}</h1>
          ${noteBlock}
          ${valueLine}
          <p style="margin:0 0 6px;color:#475569;line-height:1.55">Workspace: <strong>${escape(deal.workspace.name)}</strong> · Termin: <strong>${escape(when)}</strong></p>
          <a href="${url}" style="display:inline-block;margin-top:14px;padding:10px 18px;background:linear-gradient(140deg,#7C5CFF,#D247B5);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Otwórz deal</a>
        </div>
      </div>
    </body></html>`;
    const r = await sendEmail({
      to: recipient.email,
      subject: `⏰ Deal: ${deal.title}`,
      html,
    });
    if (r.sent) sent++;
    else failures.push(`${recipient.email}: ${r.error ?? r.skipped ?? "unknown"}`);
    await db.deal.update({
      where: { id: deal.id },
      data: { reminderSentAt: now },
    });
  }

  return {
    tasksProcessed: due.length,
    todosProcessed: todoDue.length,
    dealsProcessed: dealDue.length,
    emailsSent: sent,
    failures,
  };
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await runSweep(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
