import "server-only";

// F14: odczyt i sprzątanie dostępów. Osobno od `access-actions.ts`, bo tam
// obowiązuje "use server" i każdy eksport byłby akcją wołaną z przeglądarki —
// `dropResourceAccess` czy odczyt cudzych dostępów nie mogą być publiczne.

import { db } from "@/lib/db";
import type { ResourceKind } from "@/lib/resource-access";

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

/** Czy zalogowany może zarządzać dostępem do tego rodzaju obiektów (do UI). */
