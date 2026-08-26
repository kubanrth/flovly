import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspacesLayoutToggle } from "@/components/workspaces/workspaces-layout-toggle";
import {
  SortableWorkspacesGrid,
  SortableWorkspacesList,
  type WorkspaceRow,
} from "@/components/workspaces/sortable-workspaces";
import { workspacePl } from "@/lib/pluralize";
import { AppShell } from "@/components/layout/app-shell";

export default async function WorkspacesPage({
  searchParams,
}: {
  // `?new=1` — wejście z menu „Utwórz" w top barze (SHELL-API).
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  const { new: openNew } = await searchParams;

  // Honour user-set drag-and-drop order; fall back to createdAt for fresh rows.
  const memberships = await db.workspaceMembership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: {
      workspace: {
        include: {
          _count: { select: { boards: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: [
      { workspace: { order: "asc" } },
      { workspace: { createdAt: "asc" } },
    ],
  });

  const rows: WorkspaceRow[] = memberships.map(({ workspace, role }) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    description: workspace.description,
    role,
    boardCount: workspace._count.boards,
  }));

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <header className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-[-0.3px]">Przestrzenie</h1>
          <span className="mt-1.5 text-xs text-fg-2">
            {memberships.length} {workspacePl(memberships.length)}
          </span>
          <span className="flex-1" />
          <CreateWorkspaceDialog defaultOpen={openNew === "1"} />
        </header>

        <WorkspacesLayoutToggle
          grid={<SortableWorkspacesGrid rows={rows} />}
          list={<SortableWorkspacesList rows={rows} />}
        />
      </div>
    </AppShell>
  );
}
