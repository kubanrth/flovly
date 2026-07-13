import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { SecretVault } from "@/components/passwords/secret-vault";

// F12-K132: team password vault. Workspace-scoped, każdy członek widzi
// pełną listę sekretów; password/notes NIE są w SSR — user klika "Pokaż"
// i wtedy revealSecretAction decrypt'uje pod jego session'em.
export default async function PasswordVaultPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const items = await db.secretItem.findMany({
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
  });

  const list = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    url: i.url,
    username: i.username,
    hasNotes: i.notesEnc !== null,
    owner: i.owner,
    updatedAt: i.updatedAt.toISOString(),
  }));

  return <SecretVault workspaceId={workspaceId} items={list} />;
}
