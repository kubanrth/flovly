// F12-K79: Server wrapper który fetcha aktywne share linki + wbudowuje
// klient-side dialog. Używany w header'ze każdego board view (table/kanban/
// calendar/...).
//
// Render conditional na permission "board.share" — pomijamy gdy user nie
// może udostępniać (np. VIEWER).

import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import {
  ShareBoardDialog,
  type ShareLinkRow,
} from "@/components/board/share-board-dialog";

function buildShareUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "https://flovly.pl";
  return `${base}/share/${token}`;
}

export async function ShareBoardButton({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  if (!can(ctx.role, "board.share")) return null;

  const links = await db.boardShareLink.findMany({
    where: { boardId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const initialLinks: ShareLinkRow[] = links.map((l) => ({
    id: l.id,
    token: l.token,
    name: l.name,
    url: buildShareUrl(l.token),
    createdAt: l.createdAt.toISOString(),
    lastAccessedAt: l.lastAccessedAt ? l.lastAccessedAt.toISOString() : null,
    accessCount: l.accessCount,
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
  }));

  return (
    <ShareBoardDialog
      workspaceId={workspaceId}
      boardId={boardId}
      initialLinks={initialLinks}
    />
  );
}
