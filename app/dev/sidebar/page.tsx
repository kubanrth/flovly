"use client";

// Dev-only preview of <Sidebar> with mock props (staging DB blocks the real
// (app) layout). ?path=/inbox mocks the pathname for active-state checks.
import { notFound } from "next/navigation";
import { NavigationPromisesContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useState, useSyncExternalStore } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import type { ShellUser, SidebarWorkspace } from "@/components/layout/shell-types";

const user: ShellUser = { id: "u1", email: "daniel@nazwa.pl", name: "Daniel", avatarUrl: null, isSuperAdmin: true };
const workspaces: SidebarWorkspace[] = [
  {
    id: "ws1",
    name: "Projekty AI",
    slug: "projekty-ai",
    role: "ADMIN",
    enabledViews: ["TABLE", "KANBAN"],
    openSupportCount: 2,
    boards: [
      { id: "b1", name: "P&R Kickback" },
      { id: "b2", name: "P&R SLOT64" },
      { id: "b3", name: "Sklep Legia" },
    ],
  },
  { id: "ws2", name: "Wewnętrzne", slug: "wewnetrzne", role: "MEMBER", enabledViews: ["TABLE"], openSupportCount: 0, boards: [{ id: "b4", name: "Backlog" }] },
];

export default function DevSidebarPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [mobileOpen, setMobileOpen] = useState(true);
  // Client-only render: the mocked PathnameContext must win on both passes.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;
  const path = new URLSearchParams(window.location.search).get("path") ?? "/inbox";
  return (
    <NavigationPromisesContext.Provider value={null}>
    <PathnameContext.Provider value={path}>
      <div className="flex h-dvh bg-background">
        <Sidebar user={user} workspaces={workspaces} unreadNotificationCount={5} myTasksCount={12} mode="expanded" mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <Sidebar user={user} workspaces={workspaces} unreadNotificationCount={5} myTasksCount={12} mode="rail" mobileOpen={false} onMobileClose={() => {}} />
        <div className="flex-1 p-6 text-sm text-muted-foreground">
          <button type="button" className="underline" onClick={() => setMobileOpen(true)}>Otwórz drawer (mobile)</button>
        </div>
      </div>
    </PathnameContext.Provider>
    </NavigationPromisesContext.Provider>
  );
}
