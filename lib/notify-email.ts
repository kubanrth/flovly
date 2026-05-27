// Shared template + sender dla in-app notification emails.
// Każdy notification type podaje subject + eyebrow + CTA;
// wizualnie spójny z send-reminders email.

import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { escapeHtml as escape } from "@/lib/html-escape";

interface NotifyEmailInput {
  // Recipient — pełny obiekt albo userId (helper dofetchuje email).
  to: { email: string; name: string | null } | { userId: string };
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
  subject: string;
  attribution?: string;
}

export async function sendNotificationEmail(input: NotifyEmailInput): Promise<void> {
  let email: string | null = null;
  if ("email" in input.to) {
    email = input.to.email;
  } else {
    const user = await db.user.findUnique({
      where: { id: input.to.userId },
      select: { email: true },
    });
    email = user?.email ?? null;
  }
  if (!email) return;

  const appBase = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const ctaUrl = appBase ? `${appBase}${input.ctaPath}` : input.ctaPath;

  const html = renderNotificationHtml({
    eyebrow: input.eyebrow,
    title: input.title,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaUrl,
    attribution: input.attribution,
  });

  await sendEmail({
    to: email,
    subject: input.subject,
    html,
  });
}

function renderNotificationHtml(p: {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  attribution?: string;
}): string {
  return `<!doctype html><html lang="pl"><body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0F172A;padding:24px;background:#F8FAFC">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
    <div style="padding:24px 24px 20px">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7B68EE">${escape(p.eyebrow)}${
        p.attribution ? ` · ${escape(p.attribution)}` : ""
      }</div>
      <h1 style="margin:6px 0 12px;font-size:20px;line-height:1.3;font-weight:600">${escape(p.title)}</h1>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6;font-size:14px">${escape(p.body)}</p>
      <a href="${p.ctaUrl}" style="display:inline-block;padding:10px 18px;background:linear-gradient(135deg,#7B68EE,#BA68C8);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${escape(p.ctaLabel)} →</a>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #F1F5F9;background:#FAFBFC">
      <p style="margin:0;color:#94A3B8;font-size:11px;line-height:1.5">FLOVLY · Otrzymujesz tę wiadomość, ponieważ jesteś członkiem przestrzeni roboczej.</p>
    </div>
  </div>
</body></html>`;
}
