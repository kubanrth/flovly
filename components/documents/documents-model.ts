// F13 „Dokumenty" — kto widzi dokument. Jedno miejsce dla akcji pobierania
// i dla zapytania strony, żeby lista i pobranie nigdy się nie rozjechały.
// Self-check: `npx tsx components/documents/documents-model.check.ts`.

export type DocRole = "ADMIN" | "MEMBER" | "VIEWER";

/** ADMIN widzi wszystko; poza tym osoba wgrywająca i osoby z listy dostępu. */
export function canSeeDocument(
  viewer: { role: DocRole; userId: string },
  doc: { uploaderId: string; accessUserIds: readonly string[] },
): boolean {
  return viewer.role === "ADMIN" || doc.uploaderId === viewer.userId || doc.accessUserIds.includes(viewer.userId);
}

/** Ten sam warunek jako fragment `where` dla Prismy — dla listy na stronie. */
export function visibleDocumentsWhere(viewer: { role: DocRole; userId: string }) {
  return viewer.role === "ADMIN"
    ? {}
    : { OR: [{ uploaderId: viewer.userId }, { access: { some: { userId: viewer.userId } } }] };
}
