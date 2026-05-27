import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardShell } from "@/components/view/board-shell";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { parseEnabledViews } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";
import { BoardOverviewEditor } from "@/components/view/board-overview-editor";
import type { RichTextDoc } from "@/components/task/rich-text-editor";

// Per-board wiki/notes (Tiptap) rendered inside BoardShell so all views +
// the Overview tab share one layout.
export default async function BoardOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      views: { select: { type: true, name: true } },
    },
  });
  if (!board) notFound();

  const enabledViews = parseEnabledViews(board.workspace.enabledViews);
  const canEdit = can(ctx.role, "board.update");

  const bgCss = backgroundToCss((board as unknown as { background?: BackgroundConfig | null }).background ?? null);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        enabledViews={enabledViews}
      />

      <BoardOverviewEditor
        workspaceId={workspaceId}
        boardId={board.id}
        initial={(board.overviewJson ?? null) as RichTextDoc | null}
        canEdit={canEdit}
      />
    </BoardShell>
  );
}
