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
      {/* Board views keep the horizontal clip (wide tables/timelines); the
          overview page must not have it — it cancels the RouteFrame padding
          with negative margins to go full-bleed (header/tabs/footer strips). */}
      {/* min-h-0 is load-bearing: a column flex item defaults to
          min-height:auto and grows to its content, so every `min-h-0 flex-1`
          below it inherits an unbounded height and page footers slide under
          the fold. This used to be masked by an unconditional overflow-x-hidden
          (overflow != visible zeroes the automatic minimum size); once that was
          scoped to board routes, the tool screens lost their clamp. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col [&:has([data-ui=board-header])]:overflow-x-hidden">{children}</div>
      {modal}
      <CzesiekFab workspaceId={workspace.id} />
    </>
  );
}
