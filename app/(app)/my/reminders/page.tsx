import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RemindersWorkspace } from "@/components/my/reminders/reminders-workspace";
import { AppShell } from "@/components/layout/app-shell";

// Personal reminders sent OR received. Separate from task reminders (which
// run through the email cron); these surface as in-app popups.
export default async function MyRemindersPage() {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;

  const now = new Date();
  const [sent, received, members, oldCount, oldReceivedCount] = await Promise.all([
    db.personalReminder.findMany({
      where: { creatorId: userId },
      orderBy: { dueAt: "asc" },
      include: { recipient: { select: { id: true, name: true, email: true } } },
    }),
    db.personalReminder.findMany({
      where: {
        recipientId: userId,
        creatorId: { not: userId },
        // Filter recipient-hidden so the bulk action actually clears the view.
        recipientHiddenAt: null,
      },
      orderBy: { dueAt: "asc" },
      include: { creator: { select: { id: true, name: true, email: true } } },
    }),
    // Assignee pool: only users who share a workspace with the current user.
    db.user.findMany({
      where: {
        OR: [
          { id: userId },
          {
            memberships: {
              some: {
                workspace: {
                  deletedAt: null,
                  memberships: { some: { userId } },
                },
              },
            },
          },
        ],
        isBanned: false,
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    // Count of my reminders the cleanup button would purge (past-due OR
    // dismissed). Drives whether the button renders and its label.
    db.personalReminder.count({
      where: {
        creatorId: userId,
        OR: [{ dueAt: { lt: now } }, { dismissedAt: { not: null } }],
      },
    }),
    // Mirror count for the recipient-side "Ukryj stare" button — only counts
    // received reminders that are still visible (not yet hidden) and qualify
    // as old (past-due OR dismissed).
    db.personalReminder.count({
      where: {
        recipientId: userId,
        creatorId: { not: userId },
        recipientHiddenAt: null,
        OR: [{ dueAt: { lt: now } }, { dismissedAt: { not: null } }],
      },
    }),
  ]);

  return (
    <AppShell>
      <RemindersWorkspace
        currentUserId={userId}
        oldCount={oldCount}
        oldReceivedCount={oldReceivedCount}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
        }))}
        sent={sent.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          dueAt: r.dueAt.toISOString(),
          dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
          recipientName: r.recipient.name ?? r.recipient.email,
          recipientId: r.recipient.id,
          isMine: true,
        }))}
        received={received.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          dueAt: r.dueAt.toISOString(),
          dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
          creatorName: r.creator.name ?? r.creator.email,
          creatorId: r.creator.id,
          isMine: false,
        }))}
      />
    </AppShell>
  );
}
