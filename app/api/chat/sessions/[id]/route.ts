// F12-K74 Czesiek AI — per-session ops.
//
// GET    /api/chat/sessions/[id]  → pełen thread (messages)
// DELETE /api/chat/sessions/[id]  → kasuje sesję (cascade na messages)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getOwnedSession(sessionId: string, userId: string) {
  return db.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, workspaceId: true, title: true, updatedAt: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const chatSession = await getOwnedSession(id, session.user.id);
  if (!chatSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db.chatMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      toolName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    session: {
      id: chatSession.id,
      title: chatSession.title,
      workspaceId: chatSession.workspaceId,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getOwnedSession(id, session.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.chatSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
