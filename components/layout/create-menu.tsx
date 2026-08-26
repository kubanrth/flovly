"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  Button, IconBoards, IconChevronDown, IconContacts, IconGrid, IconNotes, IconPlus, IconRecent, IconReminders, IconSales, IconTasks,
  Menu, MenuContent, MenuItem, MenuTrigger,
} from "@/components/ui";
import { CreateTaskDialog } from "@/components/task/create-task-button";
import type { ShellBoard } from "@/components/layout/shell-types";

export interface CreateMenuProps {
  boards: ShellBoard[];
  workspaces: { id: string; name: string }[];
  taskOpen: boolean;
  onTaskOpenChange: (open: boolean) => void;
}

// A3 „Utwórz" menu. Active workspace/board come from the URL (/w/<ws>/b/<board>), else the first workspace.
export function CreateMenu({ boards, workspaces, taskOpen, onTaskOpenChange }: CreateMenuProps) {
  const router = useRouter();
  const m = usePathname().match(/^\/w\/([^/]+)(?:\/b\/([^/]+))?/);
  const ws = m?.[1] ?? workspaces[0]?.id;
  const boardId = m?.[2];
  const go = (href: string) => () => router.push(href);
  // ponytail: bez workspace'u wszystkie pozycje per-workspace prowadzą do /workspaces (onboarding stworzy pierwszy).
  const w = (path: string) => (ws ? `/w/${ws}${path}` : "/workspaces");

  return (
    <>
      <Menu>
        <MenuTrigger render={<Button variant="primary" size="md" className="group" />}>
          <IconPlus />Utwórz<IconChevronDown className="transition-transform duration-150 group-data-popup-open:rotate-180" />
        </MenuTrigger>
        <MenuContent data-ui="create-menu" align="start" sideOffset={6}>
          <MenuItem icon={<IconTasks />} shortcut="C" onClick={() => onTaskOpenChange(true)}>Zadanie</MenuItem>
          <MenuItem icon={<IconBoards />} onClick={go(w("?new=board"))}>Tablica</MenuItem>
          <MenuItem icon={<IconGrid />} onClick={go("/workspaces?new=1")}>Przestrzeń</MenuItem>
          <MenuItem icon={<IconContacts />} onClick={go(w("/contacts/new"))}>Kontakt</MenuItem>
          <MenuItem icon={<IconSales />} onClick={go(w("/sales/new"))}>Deal</MenuItem>
          <MenuItem icon={<IconNotes />} onClick={go("/my/notes?new=1")}>Notatka</MenuItem>
          <MenuItem icon={<IconReminders />} onClick={go("/my/reminders?new=1")}>Przypomnienie</MenuItem>
          <MenuItem icon={<IconRecent />} onClick={go(w("/time?new=1"))}>Wpis czasu</MenuItem>
        </MenuContent>
      </Menu>
      {ws && <CreateTaskDialog workspaceId={ws} boardId={boardId} boards={boards} open={taskOpen} onOpenChange={onTaskOpenChange} />}
    </>
  );
}
