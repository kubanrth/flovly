import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { WikiPage } from "@/components/wiki/wiki-page";
import type { RichTextDoc } from "@/components/task/rich-text-editor";

// Backfills a WikiPage for legacy workspaces so first-visit never 404s.
async function ensureWikiPage(workspaceId: string, workspaceName: string) {
  const existing = await db.wikiPage.findUnique({
    where: { workspaceId },
    include: { updatedBy: { select: { name: true, email: true, avatarUrl: true } } },
  });
  if (existing) return existing;

  const created = await db.wikiPage.create({
    data: {
      workspaceId,
      title: "O projekcie",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: workspaceName }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text:
                  "Opisz tutaj cel projektu, kluczowych ludzi, kamienie milowe i wszystko, co powinno być pod ręką.",
              },
            ],
          },
        ],
      },
    },
    include: { updatedBy: { select: { name: true, email: true, avatarUrl: true } } },
  });
  return created;
}

export default async function WorkspaceWikiPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const wiki = await ensureWikiPage(workspaceId, workspace.name);

  return (
    <WikiPage
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      canEdit={can(ctx.role, "wiki.edit")}
      page={{
        title: wiki.title,
        contentJson: (wiki.contentJson ?? null) as RichTextDoc | null,
        editorName: wiki.updatedBy?.name ?? wiki.updatedBy?.email ?? null,
        editorAvatar: wiki.updatedBy?.avatarUrl ?? null,
        updatedLabel: wiki.updatedAt.toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }}
    />
  );
}
