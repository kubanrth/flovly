import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { broadcastUserChange } from "@/lib/realtime";

// F12-K62: powiadomienia do wszystkich członków workspace'u (minus
// actor) o evencie na tablicy — utworzenie zadania, zmiana statusu.
//
// Recipient model: workspace membership. Świadomie nie filtrujemy
// per-board (PUBLIC vs PRIVATE + BoardMembership), bo:
//   1) klient (Daniel) zażyczył sobie "team-wide visibility" na
//      tablicy z powiadomieniami,
//   2) i tak link prowadzi do task page; jeśli user nie ma dostępu
//      do private boardu, dostanie 404 przy klikaniu — minor edge
//      case, akceptowalne dla v1.
//
// Wydajność: 1× workspaceMembership.findMany + 1× notification.createMany
// + 1× notification.findMany (na ID) + Promise.all broadcastUserChange.
// Stara O(N round-trips) z `.map(create)` była flagowana w audycie
// (F12-K60 review).
export async function notifyBoardEvent(params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  boardId: string;
  boardName: string | null;
  actorId: string;
  actorName: string | null;
  type: "task.created" | "task.status.changed";
  // F12-K62: dla task.status.changed — opcjonalne nazwy statusów do
  // wyrenderowania "X → Y" w treści notyfikacji.
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

  // F12-K62: createMany dla performance (audit feedback z F12-K60).
  await db.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: params.type,
      payload,
    })),
  });

  // F12-K62: re-fetch IDs (createMany ich nie zwraca) tylko dla świeżo
  // dodanych userów. Filtrujemy po createdAt w wąskim okienku 5s żeby
  // nie złapać niezwiązanych notyfikacji jeśli były concurrent inserts.
  const fresh = await db.notification.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      type: params.type,
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    select: { id: true, userId: true },
  });

  // Live toast w prawym górnym rogu każdego recipient'a.
  await Promise.all(
    fresh.map((n) =>
      broadcastUserChange(n.userId, { kind: "notification.new", id: n.id }),
    ),
  );
}
