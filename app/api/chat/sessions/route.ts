// F12-K74 Czesiek AI — session management.
//
// GET  /api/chat/sessions?workspaceId=X  → lista sesji usera w workspace
// POST /api/chat/sessions  body: { workspaceId }  → nowa pusta sesja

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const membership = await db.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      workspace: { deletedAt: null },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await db.chatSession.findMany({
    where: {
      workspaceId,
      userId: session.user.id,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
    })),
  });
}

const POST_SCHEMA = z.object({ workspaceId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const membership = await db.workspaceMembership.findFirst({
    where: {
      workspaceId: parsed.data.workspaceId,
      userId: session.user.id,
      workspace: { deletedAt: null },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newSession = await db.chatSession.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      userId: session.user.id,
    },
  });

  return NextResponse.json({
    session: {
      id: newSession.id,
      title: newSession.title,
      updatedAt: newSession.updatedAt.toISOString(),
      messageCount: 0,
    },
  });
}
