import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { SecretVault } from "@/components/passwords/secret-vault";
import { changedLabel } from "@/components/passwords/vault-model";

// E6 „Hasła" — sejf zespołu. Workspace-scoped: każdy członek widzi listę
// wpisów, ale NIGDY plaintextu. `select` poniżej celowo nie pobiera
// `passwordEnc`/`passwordIv`/`notesIv` — odszyfrowanie robi wyłącznie
// `revealSecretAction` po jawnym kliknięciu 👁, per wpis, z ponownym
// sprawdzeniem członkostwa. Nie dodawać tu pól z sekretami.
export default async function PasswordVaultPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [items, memberships] = await Promise.all([
    db.secretItem.findMany({
      where: { workspaceId, deletedAt: null },
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

  return (
    <SecretVault
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
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
