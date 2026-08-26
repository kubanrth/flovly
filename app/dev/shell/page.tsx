import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import type { AppFrameProps } from "@/components/layout/shell-types";

export const dynamic = "force-dynamic";

const MOCK: Omit<AppFrameProps, "children"> = {
  user: { id: "u1", name: "Daniel", email: "daniel@nazwa.pl", avatarUrl: null, isSuperAdmin: true },
  workspaces: [
    { id: "ws1", name: "Projekty AI", slug: "projekty-ai", role: "ADMIN", enabledViews: [], openSupportCount: 2, boards: [{ id: "b1", name: "P&R Kickback" }, { id: "b2", name: "P&R SLOT64" }, { id: "b3", name: "Sklep Legia" }] },
    { id: "ws2", name: "Wewnętrzne", slug: "wewnetrzne", role: "MEMBER", enabledViews: [], openSupportCount: 0, boards: [{ id: "b4", name: "Backlog" }] },
  ],
  boards: [
    { id: "b1", name: "P&R Kickback", workspaceId: "ws1", workspaceName: "Projekty AI" },
    { id: "b2", name: "P&R SLOT64", workspaceId: "ws1", workspaceName: "Projekty AI" },
    { id: "b3", name: "Sklep Legia", workspaceId: "ws1", workspaceName: "Projekty AI" },
    { id: "b4", name: "Backlog", workspaceId: "ws2", workspaceName: "Wewnętrzne" },
  ],
  unreadNotificationCount: 5,
  myTasksCount: 12,
};

// Podgląd shell'a (A2/A3) z mockami — tylko dev.
export default function DevShellPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppFrame {...MOCK}>
      <div className="m-6 flex h-[calc(100%-48px)] items-center justify-center rounded-lg border border-dashed border-n-300 bg-canvas font-mono text-xs text-n-500">
        obszar widoku
      </div>
    </AppFrame>
  );
}
