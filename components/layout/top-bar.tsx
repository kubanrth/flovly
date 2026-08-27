"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/mark";
import { Avatar, Badge, Button, IconBell, IconChevronDown, IconHelp, IconMenu, IconSearch, IconSettings, Kbd } from "@/components/ui";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { CreateMenu } from "@/components/layout/create-menu";
import { ShortcutsSheet } from "@/components/layout/shortcuts-sheet";
import { openCommandPalette, useHotkeys } from "@/components/layout/hotkeys";
import type { TopBarProps } from "@/components/layout/shell-types";

// Icon button: 32px desktop, 44px touch target on mobile (A2 / A2-mobile).
const ICON_BASE = "relative size-11 shrink-0 items-center justify-center rounded-md text-n-600 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 data-popup-open:bg-n-100 data-popup-open:text-foreground md:size-8";
const ICON_BTN = `inline-flex ${ICON_BASE}`;

export function TopBar({ user, unreadCount, boards, workspaces, onToggleSidebar }: TopBarProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const openTask = useCallback(() => setTaskOpen(true), []);
  useHotkeys({ onShortcuts: openShortcuts, onCreateTask: openTask });
  const name = user.name ?? user.email;

  return (
    <header data-ui="topbar" className="sticky top-0 z-[var(--z-sticky)] flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 md:gap-2 md:px-3">
      <button type="button" aria-label="Przełącz pasek boczny" onClick={onToggleSidebar} className={ICON_BTN}><IconMenu /></button>
      <Link href="/workspaces" className="rounded-md px-1 outline-none"><Wordmark /></Link>
      <span className="flex-1" />

      <button
        type="button"
        onClick={openCommandPalette}
        className="hidden h-8 w-[480px] items-center gap-2 rounded-sm border border-input-border bg-card px-2.5 text-left text-sm text-fg-3 outline-none hover:border-input-border-hover active:bg-n-50 md:flex"
      >
        <IconSearch width={14} height={14} className="shrink-0" />
        <span className="flex-1">Szukaj zadań, tablic, osób…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="hidden md:block">
        <CreateMenu boards={boards} workspaces={workspaces} taskOpen={taskOpen} onTaskOpenChange={setTaskOpen} />
      </div>
      <span className="hidden flex-1 md:block" />

      <button type="button" aria-label="Szukaj" onClick={openCommandPalette} className={`${ICON_BTN} md:hidden`}><IconSearch /></button>
      <Link href="/inbox" aria-label={`Powiadomienia${unreadCount ? ` (${unreadCount})` : ""}`} className={ICON_BTN}>
        <IconBell />
        {unreadCount > 0 && (
          <Badge tone="red" className="absolute top-2 right-2 h-3.5 min-w-3.5 border-[1.5px] border-card px-[3px] text-[9px] md:top-0.5 md:right-0.5">{unreadCount}</Badge>
        )}
      </Link>
      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <Button variant="ghost" size="md" iconOnly aria-label="Skróty klawiszowe" className="hidden md:inline-flex"><IconHelp /></Button>
      </ShortcutsSheet>
      <Link href="/profile" aria-label="Ustawienia" className={`hidden md:inline-flex ${ICON_BASE}`}><IconSettings /></Link>
      <AvatarMenu
        user={user}
        trigger={
          <span className="inline-flex items-center gap-1 p-0.5 md:mr-0 mr-1">
            <Avatar name={name} src={user.avatarUrl} size={32} className="md:hidden" />
            <Avatar name={name} src={user.avatarUrl} size={28} className="hidden md:inline-flex" />
            <IconChevronDown width={12} height={12} className="hidden text-fg-3 md:block" />
          </span>
        }
      />
    </header>
  );
}
