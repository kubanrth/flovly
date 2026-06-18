"use client";

// F12-K83: profile dropdown — popover na bottom user widget w sidebarze.
// Zastępuje wcześniejszy <Link href="/profile">  bezpośrednio na widget'cie.
// Pozwala na quick-access: Konto / Powiadomienia / 2FA / Sesje / Wyloguj.

import Link from "next/link";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import {
  Bell,
  ChevronRight,
  LogOut,
  Monitor,
  ShieldCheck,
  User,
} from "lucide-react";

import { signOutAction } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

export interface ProfileDropdownUser {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export function ProfileDropdown({
  user,
  children,
}: {
  user: ProfileDropdownUser;
  // Trigger renderowany na zewnątrz (sidebar user widget jako button).
  children: React.ReactNode;
}) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  const items: Array<{
    href: string;
    icon: React.ReactNode;
    label: string;
  }> = [
    ...(user.isSuperAdmin
      ? [{ href: "/admin", icon: <ShieldCheck size={15} />, label: "Panel admina" }]
      : []),
    { href: "/profile", icon: <User size={15} />, label: "Ustawienia konta" },
    { href: "/inbox", icon: <Bell size={15} />, label: "Powiadomienia" },
    { href: "/profile#2fa", icon: <ShieldCheck size={15} />, label: "2FA" },
    { href: "/profile#sesje", icon: <Monitor size={15} />, label: "Sesje" },
  ];

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={(triggerProps) => (
          <button
            type="button"
            {...triggerProps}
            // Re-style nie potrzebny — trigger przekazuje children jak są.
            className="w-full text-left"
          >
            {children}
          </button>
        )}
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="top"
          align="start"
          sideOffset={8}
          className="isolate z-[60]"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "popover-glass w-[240px] overflow-hidden p-0",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100",
            )}
          >
            {/* Header: avatar + name + email */}
            <div className="flex items-center gap-2.5 border-b border-black/5 px-3 py-3 dark:border-white/10">
              <span
                className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] font-display text-[12px] font-bold text-white"
                style={{ background: "linear-gradient(140deg,#7C5CFF,#E1318F)" }}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  {user.name ?? user.email.split("@")[0]}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="p-1.5">
              {items.map((it) => (
                <PopoverPrimitive.Close
                  key={it.href}
                  render={
                    <Link
                      href={it.href}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/[0.06]"
                    >
                      <span className="text-foreground/60">{it.icon}</span>
                      <span className="flex-1">{it.label}</span>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/50"
                      />
                    </Link>
                  }
                />
              ))}

              <div className="my-1 h-px bg-black/5 dark:bg-white/[0.06]" />

              <ThemeToggle variant="menu-item" />

              <div className="my-1 h-px bg-black/5 dark:bg-white/[0.06]" />

              {/* signOutAction zostaje 1:1 — żadnej zmiany auth flow. */}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#FB7185] transition-colors hover:bg-[#FB7185]/10"
                >
                  <LogOut size={15} />
                  <span className="flex-1">Wyloguj się</span>
                </button>
              </form>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
