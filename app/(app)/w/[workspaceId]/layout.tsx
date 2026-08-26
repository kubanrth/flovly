import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { CzesiekFab } from "@/components/czesiek/czesiek-fab";

// Membership gate + intercepting task modal slot. The workspace header lives in
// the overview/members/settings pages (components/workspace/workspace-header);
// board routes render their own BoardHeader.
export default async function WorkspaceLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!workspace) notFound();

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
      {modal}
      <CzesiekFab workspaceId={workspace.id} />
    </>
  );
}
