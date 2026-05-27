import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Due personal reminders dla zalogowanego usera. ReminderPopups poll'uje
// co 60s — bez tego SSR-fetched static lista nie pokazywałaby nowych
// reminderów bez ręcznego refresha.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }
  const items = await db.personalReminder.findMany({
    where: {
      recipientId: session.user.id,
      dueAt: { lte: new Date() },
      dismissedAt: null,
    },
    orderBy: { dueAt: "asc" },
    take: 5,
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      creatorName: r.creator.name ?? r.creator.email,
      isSelfAuthored: r.creator.id === session.user.id,
    })),
  });
}
