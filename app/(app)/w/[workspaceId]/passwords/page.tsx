import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { accessMapFor, allowedResourceIds } from "@/lib/access-queries";
import { needsAccessFilter } from "@/lib/resource-access";
import { SecretVault } from "@/components/passwords/secret-vault";
import { changedLabel } from "@/components/passwords/vault-model";

// E6 „Hasła" — sejf zespołu. Workspace-scoped: każdy członek widzi listę
// wpisów, ale NIGDY plaintextu. `select` poniżej celowo nie pobiera
// `passwordEnc`/`passwordIv`/`notesIv` — odszyfrowanie robi wyłącznie
// `revealSecretAction` po jawnym kliknięciu 👁, per wpis, po sprawdzeniu
// uprawnienia `secret.read`. Nie dodawać tu pól z sekretami.
//
// Flagi poniżej tylko chowają kontrolki — decyduje serwer w actions.ts.
export default async function PasswordVaultPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  // F14: wpis jest prywatny, dopóki ktoś go nie udostępni — widzi go ADMIN,
  // osoba, która go dodała, i osoby z listy dostępu.
  const viewer = { role: ctx.role, userId: ctx.userId };
  const allowed = needsAccessFilter(viewer) ? await allowedResourceIds(workspaceId, "SECRET", ctx.userId) : null;

  const [items, memberships] = await Promise.all([
    db.secretItem.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(allowed ? { OR: [{ ownerId: ctx.userId }, { id: { in: allowed } }] } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        url: true,
        username: true,
        notesEnc: true,
        owner: { select: { id: true, name: true, email: true } },
        updatedAt: true,
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const now = new Date().getTime();
  const accessMap = await accessMapFor("SECRET", items.map((i) => i.id));

  return (
    <SecretVault
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canReveal={can(ctx.role, "secret.read")}
      canManage={can(ctx.role, "secret.manage")}
      accessMap={accessMap}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        url: i.url,
        username: i.username,
        // Tylko flaga — treść notatki jest szyfrowana i schodzi wyłącznie z reveal.
        hasNotes: i.notesEnc !== null,
        owner: i.owner,
        changedLabel: changedLabel(i.updatedAt.toISOString(), now),
      }))}
      members={memberships.map((m) => m.user)}
    />
  );
}
