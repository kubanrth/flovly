import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { HEADER_PALETTE } from "@/lib/colors";
import { BriefEditor } from "@/components/briefs/brief-editor";
import type { BriefStatus } from "@/components/briefs/brief-segments";

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
    <BriefEditor
        brief={{
          id: brief.id,
          workspaceId: brief.workspaceId,
          title: brief.title,
          contentJson: brief.contentJson as
            | { type: "doc"; content?: unknown[] }
            | null,
          status: brief.status as BriefStatus,
          emoji: brief.emoji,
          headerColor: brief.headerColor ?? HEADER_PALETTE[0]!,
          creatorName: brief.creator.name ?? brief.creator.email,
          updatedAt: brief.updatedAt.toISOString(),
        }}
      canEdit={canEdit}
    />
  );
}
