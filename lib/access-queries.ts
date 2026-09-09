import "server-only";

// F14: odczyt i sprzątanie dostępów. Osobno od `access-actions.ts`, bo tam
// obowiązuje "use server" i każdy eksport byłby akcją wołaną z przeglądarki —
// `dropResourceAccess` czy odczyt cudzych dostępów nie mogą być publiczne.

import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { canSeeResource, needsAccessFilter, type AccessViewer, type ResourceKind } from "@/lib/resource-access";

/**
 * Id obiektów danego rodzaju udostępnionych temu użytkownikowi. Strony robią
 * z tego `where: { id: { in: [...] } }` — polimorficzny `resourceId` nie da się
 * podpiąć relacją, więc to jedno dodatkowe zapytanie na listę.
 */
export async function allowedResourceIds(workspaceId: string, kind: ResourceKind, userId: string): Promise<string[]> {
  const rows = await db.resourceAccess.findMany({ where: { workspaceId, kind, userId }, select: { resourceId: true } });
  return rows.map((r) => r.resourceId);
}

/** Mapa `resourceId → userId[]` dla listy obiektów — do pokazania, komu już udostępniono. */
export async function accessMapFor(kind: ResourceKind, resourceIds: string[]): Promise<Record<string, string[]>> {
  if (resourceIds.length === 0) return {};
  const rows = await db.resourceAccess.findMany({ where: { kind, resourceId: { in: resourceIds } }, select: { resourceId: true, userId: true } });
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.resourceId] ??= []).push(r.userId);
  return out;
}

/** Sprzątanie po skasowanym obiekcie — `resourceId` nie ma klucza obcego. */
export async function dropResourceAccess(kind: ResourceKind, resourceId: string): Promise<void> {
  await db.resourceAccess.deleteMany({ where: { kind, resourceId } });
}

/**
 * Czy `viewer` widzi konkretny obiekt — do bram w akcjach i na stronach
 * pojedynczego obiektu. ADMIN i autor nie kosztują zapytania.
 */
export async function viewerCanSee(
  kind: ResourceKind,
  viewer: AccessViewer,
  resourceId: string,
  ownerIds: readonly (string | null | undefined)[],
): Promise<boolean> {
  if (!needsAccessFilter(viewer)) return true;
  if (ownerIds.some((id) => id === viewer.userId)) return true;
  const rows = await db.resourceAccess.findMany({ where: { kind, resourceId }, select: { userId: true } });
  return canSeeResource(kind, viewer, { ownerIds, accessUserIds: rows.map((r) => r.userId) });
}

/**
 * Id obiektów, dla których ktokolwiek ustawił listę dostępu. Potrzebne w trybie
 * `restrict` (Subskrypcje, zadania, widoki): pusta lista = widzą wszyscy, więc
 * ukryć trzeba tylko te obiekty, które listę mają — i to bez nas na niej.
 */
export async function restrictedResourceIds(workspaceId: string, kind: ResourceKind): Promise<string[]> {
  const rows = await db.resourceAccess.findMany({
    where: { workspaceId, kind },
    select: { resourceId: true },
    distinct: ["resourceId"],
  });
  return rows.map((r) => r.resourceId);
}

/** Id obiektów ukrytych przed tym użytkownikiem w trybie `restrict`. */
export async function hiddenRestrictedIds(workspaceId: string, kind: ResourceKind, userId: string): Promise<string[]> {
  const [restricted, allowed] = await Promise.all([
    restrictedResourceIds(workspaceId, kind),
    allowedResourceIds(workspaceId, kind, userId),
  ]);
  const mine = new Set(allowed);
  return restricted.filter((id) => !mine.has(id));
}

/**
 * Fragment `where` ukrywający zadania zawężone do innych osób (F14, tryb
 * `restrict`). Autor i przypisani widzą swoje zadanie zawsze — inaczej dałoby
 * się komuś przydzielić zadanie, którego nie może otworzyć.
 * Spread w istniejące `where`, np. `where: { deletedAt: null, ...taskWhere }`.
 */
export async function taskVisibilityWhere(
  workspaceId: string,
  viewer: AccessViewer,
): Promise<Prisma.TaskWhereInput> {
  if (!needsAccessFilter(viewer)) return {};
  const hidden = await hiddenRestrictedIds(workspaceId, "TASK", viewer.userId);
  if (hidden.length === 0) return {};
  return {
    AND: [
      {
        OR: [
          { id: { notIn: hidden } },
          { creatorId: viewer.userId },
          { assignees: { some: { userId: viewer.userId } } },
        ],
      },
    ],
  };
}

/** Wersja dla komponentów bez `ctx` pod ręką (renderery widoków własnych). */
export async function taskVisibilityWhereFor(workspaceId: string): Promise<Prisma.TaskWhereInput> {
  const ctx = await requireWorkspaceMembership(workspaceId);
  return taskVisibilityWhere(workspaceId, ctx);
}

/**
 * Czy `viewer` widzi to zadanie — dla akcji, które dostają samo id. Autor
 * i przypisani widzą zawsze; pusta lista dostępu = widzą wszyscy z tablicy
 * (dostęp do tablicy sprawdza `userCanAccessBoard`, to jest warstwa obok).
 */
export async function canSeeTask(viewer: AccessViewer, taskId: string, creatorId: string | null): Promise<boolean> {
  if (!needsAccessFilter(viewer)) return true;
  if (creatorId === viewer.userId) return true;
  const rows = await db.resourceAccess.findMany({ where: { kind: "TASK", resourceId: taskId }, select: { userId: true } });
  if (rows.length === 0) return true;
  if (rows.some((r) => r.userId === viewer.userId)) return true;
  const assigned = await db.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId: viewer.userId } },
    select: { userId: true },
  });
  return assigned !== null;
}

/** Z listy id zostawia te zadania, które `viewer` widzi (akcje masowe). */
export async function visibleTaskIds(workspaceId: string, viewer: AccessViewer, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return ids;
  const where = await taskVisibilityWhere(workspaceId, viewer);
  if (Object.keys(where).length === 0) return ids;
  const rows = await db.task.findMany({ where: { id: { in: ids }, ...where }, select: { id: true } });
  return rows.map((r) => r.id);
}
