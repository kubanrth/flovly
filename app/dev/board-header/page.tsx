import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import type { AppFrameProps } from "@/components/layout/shell-types";
import { BoardShell } from "@/components/view/board-shell";
import { BoardHeader } from "@/components/view/board-header";
import { CreateViewDialog } from "@/components/view/create-view-dialog";
import { TableToolbar } from "@/components/view/table-toolbar";
import { ShareBoardDialog } from "@/components/board/share-board-dialog";
import type { ViewName } from "@/lib/board-views";

export const dynamic = "force-dynamic";

const FRAME: Omit<AppFrameProps, "children"> = {
  user: { id: "u1", name: "Daniel", email: "daniel@nazwa.pl", avatarUrl: null, isSuperAdmin: true },
  workspaces: [
    { id: "ws1", name: "Projekty AI", slug: "projekty-ai", role: "ADMIN", enabledViews: [], openSupportCount: 2, boards: [{ id: "b1", name: "P&R Kickback" }, { id: "b2", name: "P&R SLOT64" }] },
  ],
  boards: [{ id: "b1", name: "P&R Kickback", workspaceId: "ws1", workspaceName: "Projekty AI" }],
  unreadNotificationCount: 5,
  myTasksCount: 12,
};

const MEMBERS = ["Daniel", "Kasia", "Grzegorz", "Marta", "Ola", "Piotr", "Tomek"].map((name, i) => ({ id: `u${i + 1}`, name, avatarUrl: null }));
const ALL: ViewName[] = ["table", "kanban", "gantt", "roadmap", "calendar", "whiteboard", "taskline"];

// Podgląd nagłówka tablicy (A2/B1/B12) z mockami — tylko dev.
// ?view=table|kanban — aktywny tab; toolbar tylko na table.
export default async function DevBoardHeaderPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const active = (ALL.includes(view as ViewName) ? view : "table") as ViewName;
  return (
    <AppFrame {...FRAME}>
      <BoardShell bgCss={null}>
        <BoardHeader
          workspaceId="ws1"
          workspaceName="Projekty AI"
          boardId="b1"
          board={{ name: "P&R Kickback" }}
          active={active}
          enabledViews={ALL}
          customViews={[
            { id: "cv1", name: "Backlog P3", type: "table", path: "/dev/board-header?view=table" },
            { id: "cv2", name: "Sprint 12", type: "kanban", path: "/dev/board-header?view=kanban" },
          ]}
          canManageViews
          canEditName
          defaultViewIds={{ table: "v1", kanban: "v2" }}
          members={MEMBERS}
          toolbar={active === "table" ? <TableToolbar people={MEMBERS} /> : undefined}
          createViewButton={<CreateViewDialog workspaceId="ws1" boardId="b1" enabled={ALL} existingDefaultTypes={ALL} />}
          actions={<ShareBoardDialog workspaceId="ws1" boardId="b1" initialLinks={[]} />}
        />
        <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-n-300 bg-canvas font-mono text-xs text-n-500">
          obszar widoku — {active}
        </div>
      </BoardShell>
    </AppFrame>
  );
}
