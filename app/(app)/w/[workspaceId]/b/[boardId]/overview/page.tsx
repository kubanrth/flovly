import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
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

  // „Ostatnia zmiana” w kolumnie treści (B11) — schemat nie wersjonuje
  // dokumentu, więc autor i czas biorą się z ostatniego wpisu audytu.
  const lastAudit = await db.auditLog.findFirst({
    where: { workspaceId, objectType: "Board", objectId: board.id, action: "board.overview.updated" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, actor: { select: { name: true, email: true, avatarUrl: true } } },
  });
  const time = lastAudit?.createdAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) ?? "";
  const sameDay = lastAudit ? lastAudit.createdAt.toDateString() === new Date().toDateString() : false;
  const lastChange = lastAudit
    ? {
        name: lastAudit.actor?.name ?? lastAudit.actor?.email ?? "System",
        avatarUrl: lastAudit.actor?.avatarUrl ?? null,
        label: sameDay
          ? `dziś ${time}`
          : `${lastAudit.createdAt.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}, ${time}`,
        time,
      }
    : null;

  const bgCss = backgroundToCss((board as unknown as { background?: BackgroundConfig | null }).background ?? null);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        enabledViews={enabledViews}
      />

      <ViewTransition>
        <BoardOverviewEditor
          workspaceId={workspaceId}
          boardId={board.id}
          initial={(board.overviewJson ?? null) as RichTextDoc | null}
          canEdit={canEdit}
          lastChange={lastChange}
        />
      </ViewTransition>
    </BoardShell>
  );
}
