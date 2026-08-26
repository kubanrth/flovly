"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/ui/tabs";
import { IconBell, IconCheck, IconSettings, IconTrash } from "@/components/ui/icons";
import { useAssignHotkey, type AssignMember } from "@/components/task/assign-hotkey";
import { plPlural } from "@/lib/pluralize";
import {
  deleteAllReadNotificationsAction,
  markAllNotificationsReadAction,
  toggleNotificationReadAction,
} from "@/app/(app)/inbox/actions";
import { InboxCard } from "./inbox-card";
import { filterByTab, groupByBucket, type InboxItem, type InboxTab } from "./inbox-model";

const TABS: { value: InboxTab; label: string }[] = [
  { value: "unread", label: "Nieprzeczytane" },
  { value: "mentions", label: "Wzmianki" },
  { value: "assignments", label: "Przypisania" },
  { value: "all", label: "Wszystkie" },
];

const unreadPl = (n: number) => plPlural(n, "nieprzeczytane", "nieprzeczytane", "nieprzeczytanych");

/** Hotkeys must not fire while the user is typing (note editor, ⌘K, comments…). */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function InboxView({ items, members }: { items: InboxItem[]; members: AssignMember[] }) {
  const router = useRouter();
  const assign = useAssignHotkey({ members, workspaceId: "" });
  const [tab, setTab] = useState<InboxTab>("unread");
  // -1 = nothing focused yet, so the page does not steal focus on mount.
  const [cursor, setCursor] = useState(-1);
  const cards = useRef<(HTMLElement | null)[]>([]);

  const unreadCount = items.filter((i) => i.unread).length;
  const recentCount = items.filter((i) => i.bucket !== "earlier").length;
  const groups = groupByBucket(filterByTab(items, tab));
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (cursor >= 0) cards.current[cursor]?.focus();
  }, [cursor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        if (flat.length === 0) return;
        e.preventDefault();
        setCursor((c) => Math.max(0, Math.min(flat.length - 1, key === "j" ? c + 1 : c - 1)));
        return;
      }
      const item = flat[cursor];
      if (!item) return;
      if (e.key === "Enter") {
        // Let Enter activate a focused control instead of hijacking it.
        if ((e.target as HTMLElement | null)?.closest("a, button, [role='menuitem']")) return;
        e.preventDefault();
        router.push(item.href);
      } else if (key === "e") {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", item.id);
        startTransition(() => void toggleNotificationReadAction(fd));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, cursor, router]);

  const position = new Map(flat.map((item, i) => [item.id, i]));

  return (
    <div
      data-ui="inbox"
      // RouteFrame wraps every non-board page in px-4 py-3 / md:px-8 md:py-4 — cancel it so
      // the tab strip and the footer run edge to edge, and claim the whole viewport height
      // (main = h-dvh minus the top bar) so the footer sits on the fold.
      className="flex min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      <header className="flex shrink-0 items-center gap-2.5 px-4 pt-4 md:px-8">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Powiadomienia</h1>
        {unreadCount > 0 && (
          <Badge tone="red" className="h-5 min-w-5 rounded-[10px] px-1.5 text-2xs">
            {unreadCount}
          </Badge>
        )}
        <span className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          disabled={unreadCount === 0}
          onClick={() => startTransition(() => void markAllNotificationsReadAction())}
        >
          <IconCheck width={13} height={13} />
          <span className="max-md:sr-only">Oznacz wszystkie jako przeczytane</span>
        </Button>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="sm" iconOnly aria-label="Więcej opcji" />}>
            <IconSettings />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              icon={<IconTrash />}
              destructive
              onClick={() => {
                if (confirm("Usunąć wszystkie przeczytane powiadomienia?")) {
                  startTransition(() => void deleteAllReadNotificationsAction());
                }
              }}
            >
              Usuń przeczytane
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<IconSettings />} render={<Link href="/profile" />}>
              Ustawienia powiadomień
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as InboxTab);
          setCursor(-1);
        }}
        className="min-h-0 flex-1"
      >
        <TabsList data-ui="inbox-tabs" className="shrink-0 px-4 pt-2.5 md:px-8">
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} count={t.value === "unread" && unreadCount > 0 ? unreadCount : undefined}>
              {t.label}
            </Tab>
          ))}
        </TabsList>

        <TabsPanel value={tab} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="max-w-[860px] px-4 pt-2 pb-6 md:px-8">
              {groups.length === 0 ? (
                <EmptyState
                  icon={<IconBell />}
                  title="Pusto"
                  description="Jak ktoś Cię oznaczy w komentarzu albo przypisze do zadania, trafi to tutaj."
                />
              ) : (
                groups.map((group, gi) => (
                  <section key={group.key} className={gi === 0 ? "" : "mt-2"}>
                    <h2 data-ui="inbox-group" className="eyebrow flex h-[30px] items-end">
                      {group.label}
                    </h2>
                    <ul className="flex flex-col gap-1.5">
                      {group.items.map((item) => {
                        const i = position.get(item.id)!;
                        return (
                          <li key={item.id}>
                            <InboxCard
                              item={item}
                              active={i === cursor}
                              cardRef={(el) => {
                                cards.current[i] = el;
                              }}
                              hotkeyProps={item.task ? assign.rowProps(item.task.id, item.task.assigneeIds) : undefined}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </TabsPanel>
      </Tabs>

      <footer
        data-ui="inbox-footer"
        className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-4 font-mono text-2xs text-fg-2 md:px-8"
      >
        <span>
          {unreadCount} {unreadPl(unreadCount)} · {recentCount} dziś i wczoraj
        </span>
        <span className="ml-auto text-fg-3 max-md:hidden">pomarańczowa kropka = nieprzeczytane</span>
      </footer>

      {assign.menu}
    </div>
  );
}
