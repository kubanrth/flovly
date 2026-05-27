import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { broadcastUserChange } from "@/lib/realtime";

// Notify every workspace member (minus actor) o evencie na tablicy.
// Recipient model = workspace membership (NIE per-board) — team-wide
// visibility per client request; private board 404 przy kliknięciu
// akceptowalne dla v1.
export async function notifyBoardEvent(params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  boardId: string;
  boardName: string | null;
  actorId: string;
  actorName: string | null;
  type: "task.created" | "task.status.changed";
  fromStatusName?: string | null;
  toStatusName?: string | null;
}): Promise<void> {
  const members = await db.workspaceMembership.findMany({
    where: { workspaceId: params.workspaceId, userId: { not: params.actorId } },
    select: { userId: true },
  });
  if (members.length === 0) return;

  const payload: Prisma.InputJsonValue = {
    workspaceId: params.workspaceId,
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    boardId: params.boardId,
    boardName: params.boardName,
    actorId: params.actorId,
    actorName: params.actorName,
    ...(params.fromStatusName !== undefined
      ? { fromStatusName: params.fromStatusName }
      : {}),
    ...(params.toStatusName !== undefined
      ? { toStatusName: params.toStatusName }
      : {}),
  };

  await db.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: params.type,
      payload,
    })),
  });

  // createMany nie zwraca ID — refetch w wąskim 5s okienku żeby nie
  // złapać niezwiązanych notyfikacji z concurrent inserts.
  const fresh = await db.notification.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      type: params.type,
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    select: { id: true, userId: true },
  });

  await Promise.all(
    fresh.map((n) =>
      broadcastUserChange(n.userId, { kind: "notification.new", id: n.id }),
    ),
  );
}
