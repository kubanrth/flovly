"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useUiPref, type Density } from "@/hooks/use-ui-pref";
import type { AppFrameProps, SidebarMode } from "@/components/layout/shell-types";

// Shell: TopBar + Sidebar (expanded/rail, mobile drawer) + <main data-ui="main">.
export function AppFrame({ user, workspaces, boards, unreadNotificationCount, myTasksCount, children }: AppFrameProps) {
  const [mode, setMode] = useUiPref<SidebarMode>("ui:sidebar", "expanded");
  const [density] = useUiPref<Density>("ui:density", "comfortable");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggle = () => {
    if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen((o) => !o);
    else setMode(mode === "expanded" ? "rail" : "expanded");
  };

  return (
    <ToastProvider timeout={5000}>
      <div className="flex h-dvh flex-col">
        <TopBar user={user} unreadCount={unreadNotificationCount} boards={boards} workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))} onToggleSidebar={toggle} />
        <div className="flex min-h-0 flex-1">
          <Sidebar user={user} workspaces={workspaces} unreadNotificationCount={unreadNotificationCount} myTasksCount={myTasksCount} mode={mode} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
          {/* flex column so a view can claim the full height (footer pinned to the
              bottom) instead of collapsing to its content. */}
          <main data-ui="main" className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">{children}</main>
        </div>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
