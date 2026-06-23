"use client";

// F12-K83: workspace switcher popover — trigger to nazwa aktywnego workspace
// w headerze sidebar. Klik → lista wszystkich workspace'ów z role badge'ami,
// active tick, "+ Nowy workspace", "Zarządzaj wszystkimi".
//
// Mobile (<md): popover na 375px klipsie się przy lewej krawędzi sidebara.
// Pattern z F12-K94 (cell-pickers) — useIsMobile + bottom Sheet variant.

import { useState } from "react";
import Link from "next/link";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";

import type { Role } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export interface WorkspaceSwitcherItem {
  id: string;
  name: string;
  role: Role;
  // Member count nie jest jeszcze fetchowany w (app) layoucie — pole
  // optional żeby switcher zadziałał z istniejącymi propsami. Jak (app)
  // layout je dostarczy, badge automatycznie się pojawi.
  memberCount?: number;
}

const SWATCH_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#7C5CFF", "#D247B5"],
  ["#34BEF8", "#7C5CFF"],
  ["#34BEF8", "#10B981"],
  ["#F59E0B", "#E1318F"],
  ["#A5B4FC", "#6366F1"],
  ["#F0ABFC", "#C084FC"],
];

function swatchIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % SWATCH_GRADIENTS.length;
}

function roleLabel(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Owner";
    case "MEMBER":
      return "Member";
    case "VIEWER":
      return "Viewer";
    default:
      return role;
  }
}

function roleBadgeStyle(role: Role): { bg: string; color: string } {
  switch (role) {
    case "ADMIN":
      return { bg: "rgba(124,92,255,0.18)", color: "#C9B6F7" };
    case "MEMBER":
      return { bg: "rgba(52,190,248,0.16)", color: "#7BD5FF" };
    case "VIEWER":
      return { bg: "rgba(255,255,255,0.08)", color: "#9A91AB" };
    default:
      return { bg: "rgba(255,255,255,0.08)", color: "#9A91AB" };
  }
}

// Reużywane między Popover (desktop) a Sheet (mobile). Mobile dostaje
// `onItemClick` żeby zamknąć Sheet — w popoverze Base UI samo closuje
// przez <PopoverPrimitive.Close render={...}> wrapper.
function WorkspaceItem({
  workspace,
  active,
  mobile,
  onItemClick,
}: {
  workspace: WorkspaceSwitcherItem;
  active: boolean;
  mobile: boolean;
  onItemClick?: () => void;
}) {
  const [from, to] = SWATCH_GRADIENTS[swatchIndex(workspace.id)];
  const badge = roleBadgeStyle(workspace.role);
  const initials = workspace.name.slice(0, 2).toUpperCase();
  return (
    <Link
      href={`/w/${workspace.id}`}
      onClick={onItemClick}
      className={cn(
        "flex items-center gap-2.5 rounded-[11px] transition-colors",
        mobile ? "min-h-[48px] px-3 py-2" : "px-2.5 py-2",
        active
          ? "bg-[linear-gradient(135deg,rgba(124,92,255,0.16),rgba(210,71,181,0.10))]"
          : "hover:bg-black/5 dark:hover:bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[9px] font-display font-bold text-white",
          mobile ? "size-9 text-[12px]" : "size-8 text-[11px]",
        )}
        style={{
          background: `linear-gradient(140deg, ${from}, ${to})`,
        }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate font-semibold text-foreground",
            mobile ? "text-[14px]" : "text-[13px]",
          )}
        >
          {workspace.name}
        </div>
        {typeof workspace.memberCount === "number" && (
          <div
            className={cn(
              "text-muted-foreground",
              mobile ? "text-[12px]" : "text-[11px]",
            )}
          >
            {workspace.memberCount}{" "}
            {workspace.memberCount === 1 ? "członek" : "członków"}
          </div>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
        style={{ background: badge.bg, color: badge.color }}
      >
        {roleLabel(workspace.role)}
      </span>
      {active && (
        <Check
          size={14}
          className="shrink-0 text-primary"
          strokeWidth={2.6}
        />
      )}
    </Link>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  children,
}: {
  workspaces: WorkspaceSwitcherItem[];
  activeWorkspaceId: string | null;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full text-left"
        >
          {children}
        </button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="sheet-mobile-surface gap-0 p-0"
          >
            <div className="pt-3">
              <div className="sheet-drag-handle" aria-hidden="true" />
            </div>
            <SheetTitle className="px-4 pb-2 pt-1 text-base font-bold text-foreground">
              Workspace&apos;y
            </SheetTitle>

            <div className="max-h-[60dvh] overflow-y-auto px-2">
              {workspaces.length === 0 && (
                <div className="px-3 py-4 text-[13px] text-muted-foreground">
                  Brak workspace&apos;ów.
                </div>
              )}
              {workspaces.map((w) => (
                <WorkspaceItem
                  key={w.id}
                  workspace={w}
                  active={w.id === activeWorkspaceId}
                  mobile
                  onItemClick={() => setMobileOpen(false)}
                />
              ))}
            </div>

            <div className="mx-3 my-2 h-px bg-black/5 dark:bg-white/[0.06]" />

            <div className="px-2 pb-safe-bottom">
              <Link
                href="/workspaces"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-[11px] px-3 py-2 text-[14px] font-semibold text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-[9px] text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #7C5CFF, #E1318F)",
                  }}
                >
                  <Plus size={16} strokeWidth={2.4} />
                </span>
                <span>Nowy workspace</span>
              </Link>
              <Link
                href="/workspaces"
                onClick={() => setMobileOpen(false)}
                className="mt-0.5 flex min-h-[44px] items-center gap-2 rounded-[11px] px-3 py-2 pl-[58px] text-[13px] text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/[0.06]"
              >
                <Settings2 size={14} className="shrink-0" />
                <span>Zarządzaj wszystkimi</span>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={(triggerProps) => (
          <button
            type="button"
            {...triggerProps}
            className="w-full text-left"
          >
            {children}
          </button>
        )}
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="isolate z-[60]"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "popover-glass w-[260px] overflow-hidden p-0",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100",
            )}
          >
            <div className="px-3 pt-3 pb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground/60">
                Workspace&apos;y
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto px-1.5">
              {workspaces.length === 0 && (
                <div className="px-2.5 py-3 text-[12px] text-muted-foreground">
                  Brak workspace&apos;ów.
                </div>
              )}
              {workspaces.map((w) => (
                <PopoverPrimitive.Close
                  key={w.id}
                  render={
                    <WorkspaceItem
                      workspace={w}
                      active={w.id === activeWorkspaceId}
                      mobile={false}
                    />
                  }
                />
              ))}
            </div>

            <div className="mx-3 my-2 h-px bg-black/5 dark:bg-white/[0.06]" />

            <div className="px-1.5 pb-2">
              <PopoverPrimitive.Close
                render={
                  <Link
                    href="/workspaces"
                    className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #7C5CFF, #E1318F)",
                      }}
                    >
                      <Plus size={15} strokeWidth={2.4} />
                    </span>
                    <span>Nowy workspace</span>
                  </Link>
                }
              />
              <PopoverPrimitive.Close
                render={
                  <Link
                    href="/workspaces"
                    className="mt-0.5 flex items-center gap-2 rounded-[11px] px-2.5 py-2 pl-[46px] text-[12.5px] text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/[0.06]"
                  >
                    <Settings2 size={13} className="shrink-0" />
                    <span>Zarządzaj wszystkimi</span>
                  </Link>
                }
              />
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// Trigger helper — opcjonalny export żeby sidebar mógł użyć tej samej formy.
export function WorkspaceSwitcherTrigger({
  workspace,
  collapsed,
}: {
  workspace: WorkspaceSwitcherItem | null;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <span
        className="grid size-7 place-items-center rounded-md text-muted-foreground"
        title={workspace?.name ?? "Workspace'y"}
      >
        <ChevronsUpDown size={14} />
      </span>
    );
  }
  return (
    <span className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]">
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
        {workspace?.name ?? "Wybierz workspace"}
      </span>
      <ChevronsUpDown
        size={13}
        className="shrink-0 text-muted-foreground/60"
      />
    </span>
  );
}
