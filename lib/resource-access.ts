// F14: kto widzi pojedynczy obiekt (hasło, kontakt, whiteboard, subskrypcja,
// zadanie, widok tablicy). Czysta reguła + jedno miejsce, z którego korzystają
// strony (co pokazać) i akcje (czy wolno). Self-check: `npx tsx lib/resource-access.check.ts`.

export type ResourceKind = "SECRET" | "CONTACT" | "CANVAS" | "SUBSCRIPTION" | "TASK" | "BOARD_VIEW";
export type AccessRole = "ADMIN" | "MEMBER" | "VIEWER";

/**
 * `private`  — obiekt jest prywatny, dopóki ktoś go nie udostępni: widzi ADMIN,
 *              autor/właściciel i osoby z listy (Hasła, Kontakty, Whiteboardy).
 * `restrict` — lista jest ograniczeniem: pusta = widzą wszyscy uprawnieni jak
 *              dotąd, niepusta = tylko wskazani (i ADMIN, i autor).
 */
export const ACCESS_MODE: Record<ResourceKind, "private" | "restrict"> = {
  SECRET: "private",
  CONTACT: "private",
  CANVAS: "private",
  SUBSCRIPTION: "restrict",
  TASK: "restrict",
  BOARD_VIEW: "restrict",
};

export interface AccessViewer { role: AccessRole; userId: string }
export interface AccessSubject {
  /** Autor/właściciel — widzi zawsze. Może być kilku (np. kontakt: twórca i opiekun). */
  ownerIds?: readonly (string | null | undefined)[];
  accessUserIds: readonly string[];
}

/** Czy `viewer` widzi obiekt danego rodzaju. ADMIN widzi wszystko. */
export function canSeeResource(kind: ResourceKind, viewer: AccessViewer, subject: AccessSubject): boolean {
  if (viewer.role === "ADMIN") return true;
  if ((subject.ownerIds ?? []).some((id) => id === viewer.userId)) return true;
  if (subject.accessUserIds.includes(viewer.userId)) return true;
  // Ograniczenie działa tylko wtedy, gdy ktoś je faktycznie ustawił.
  return ACCESS_MODE[kind] === "restrict" && subject.accessUserIds.length === 0;
}

/**
 * Czy trzeba w ogóle filtrować listę po stronie serwera. ADMIN nie — widzi
 * wszystko, więc strona oszczędza jedno zapytanie o dostępy.
 */
export const needsAccessFilter = (viewer: AccessViewer) => viewer.role !== "ADMIN";

/** Etykieta pod przyciskiem „Dostęp" — mówi wprost, kto to widzi. */
export function accessLabel(kind: ResourceKind, count: number): string {
  if (count > 0) return `Dostęp: ${count}`;
  return ACCESS_MODE[kind] === "private" ? "Tylko Ty i administratorzy" : "Wszyscy w przestrzeni";
}
