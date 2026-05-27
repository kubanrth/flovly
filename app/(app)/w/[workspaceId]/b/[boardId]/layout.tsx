// Per-board access gate for every /b/[boardId]/* route. requireBoardAccess
// handles workspace membership (404 on miss), ADMIN bypass, PUBLIC vs PRIVATE
// + BoardMembership check. Children fetch their own UI data.
import { requireBoardAccess } from "@/lib/workspace-guard";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  await requireBoardAccess(workspaceId, boardId);
  return children;
}
