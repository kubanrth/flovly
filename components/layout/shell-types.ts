import type { Role, ViewType } from "@/lib/generated/prisma/client";

export interface ShellUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export interface SidebarWorkspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
  boards: { id: string; name: string }[];
  enabledViews: ViewType[];
  openSupportCount: number;
}

export interface ShellBoard {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}

// Props of <AppFrame> (client) rendered by app/(app)/layout.tsx.
export interface AppFrameProps {
  user: ShellUser;
  workspaces: SidebarWorkspace[];
  boards: ShellBoard[];
  unreadNotificationCount: number;
  myTasksCount: number;
  children: React.ReactNode;
}

export type SidebarMode = "expanded" | "rail";

export interface SidebarProps {
  user: ShellUser;
  workspaces: SidebarWorkspace[];
  unreadNotificationCount: number;
  myTasksCount: number;
  mode: SidebarMode;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export interface TopBarProps {
  user: ShellUser;
  unreadCount: number;
  boards: ShellBoard[];
  workspaces: { id: string; name: string }[];
  onToggleSidebar: () => void;
}
