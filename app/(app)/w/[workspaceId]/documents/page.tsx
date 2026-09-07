import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { DocumentsTool } from "@/components/documents/documents-tool";
import { visibleDocumentsWhere } from "@/components/documents/documents-model";

// F13 „Dokumenty" — pliki przestrzeni z dostępem per osoba. Lista jest już
// przycięta do tego, co user może widzieć (ADMIN: wszystko; reszta: własne
// i udostępnione). Pobranie i tak sprawdza to jeszcze raz w akcji.
export default async function DocumentsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [docs, memberships] = await Promise.all([
    db.document.findMany({
      where: { workspaceId, deletedAt: null, ...visibleDocumentsWhere({ role: ctx.role, userId: ctx.userId }) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true,
        uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
        access: { select: { userId: true } },
      },
    }),
    db.workspaceMembership.findMany({
      // Usunieci uzytkownicy zachowuja czlonkostwo — bez tego filtra ladowali
      // na liscie do nadania dostepu (i z martwym avatarUrl jako pusty krazek).
      where: { workspaceId, user: { deletedAt: null } },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  return (
    <DocumentsTool
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "document.manage")}
      members={memberships.map((m) => m.user)}
      documents={docs.map((d) => ({
        id: d.id, filename: d.filename, mimeType: d.mimeType, sizeBytes: d.sizeBytes, createdAt: d.createdAt.toISOString(),
        uploader: d.uploader, accessUserIds: d.access.map((a) => a.userId),
      }))}
    />
  );
}
