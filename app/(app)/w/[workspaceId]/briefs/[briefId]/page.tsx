import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BriefEditor } from "@/components/briefs/brief-editor";

export default async function CreativeBriefDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; briefId: string }>;
}) {
  const { workspaceId, briefId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const brief = await db.creativeBrief.findFirst({
    where: { id: briefId, workspaceId, deletedAt: null },
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  if (!brief) notFound();

  const canEdit =
    can(ctx.role, "task.update") || brief.creatorId === ctx.userId;

  return (
    <div className="flex-1 min-h-0">
      <BriefEditor
        brief={{
          id: brief.id,
          workspaceId: brief.workspaceId,
          title: brief.title,
          contentJson: brief.contentJson as
            | { type: "doc"; content?: unknown[] }
            | null,
          status: brief.status,
          emoji: brief.emoji,
          headerColor: brief.headerColor ?? "#7C5CFF",
          creatorName: brief.creator.name ?? brief.creator.email,
          updatedAt: brief.updatedAt.toISOString(),
        }}
        canEdit={canEdit}
      />
    </div>
  );
}
