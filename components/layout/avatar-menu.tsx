"use client";
import { startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar, IconBell, IconDensity, IconLogout, IconMonitor, IconSettings, IconShield, IconShieldCheck,
  Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger,
} from "@/components/ui";
import { DENSITY_PX, useUiPref, type Density } from "@/hooks/use-ui-pref";
import { signOutAction } from "@/app/(app)/actions";
import type { ShellUser } from "@/components/layout/shell-types";

const DENSITIES: [Density, string][] = [["compact", "Kompaktowa"], ["comfortable", "Wygodna"], ["spacious", "Przestronna"]];

// A3 avatar menu (240px). `trigger` must NOT be a <button> — the trigger element is a span with role=button.
export function AvatarMenu({ user, trigger, align = "end" }: { user: ShellUser; trigger: ReactNode; align?: "start" | "end" }) {
  const router = useRouter();
  const [density, setDensity] = useUiPref<Density>("ui:density", "comfortable");
  const name = user.name ?? user.email;
  const go = (href: string) => () => router.push(href);
  return (
    <Menu>
      <MenuTrigger nativeButton={false} aria-label="Menu użytkownika" render={<span className="inline-flex cursor-pointer select-none rounded-md outline-none data-popup-open:bg-n-100" />}>{trigger}</MenuTrigger>
      <MenuContent data-ui="avatar-menu" align={align} sideOffset={6} className="w-[240px]">
        <div className="mb-1 flex items-center gap-2.5 border-b border-n-100 px-2 py-2.5">
          <Avatar name={name} src={user.avatarUrl} size={32} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-[17px]">{name}</div>
            <div className="truncate text-2xs leading-[15px] text-fg-3">{user.email}</div>
          </div>
        </div>
        <MenuItem icon={<IconSettings />} onClick={go("/profile")}>Ustawienia konta</MenuItem>
        <MenuItem icon={<IconBell />} onClick={go("/inbox")}>Powiadomienia</MenuItem>
        <MenuItem icon={<IconShield />} onClick={go("/profile#2fa")}>Uwierzytelnianie 2FA</MenuItem>
        <MenuItem icon={<IconMonitor />} onClick={go("/profile#sessions")}>Sesje</MenuItem>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger icon={<IconDensity />}>
            Gęstość<span className="ml-auto text-xs text-fg-3">{DENSITY_PX[density]} px</span>
          </MenuSubTrigger>
          <MenuSubContent data-ui="density-menu" className="min-w-[180px]">
            <MenuRadioGroup
              value={density}
              onValueChange={(v) => {
                setDensity(v as Density);
                document.documentElement.dataset.density = v as string;
              }}
            >
              {DENSITIES.map(([v, label]) => (
                <MenuRadioItem key={v} value={v}>
                  {label}<span className="ml-2 text-xs text-fg-3">{DENSITY_PX[v]} px</span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        {user.isSuperAdmin && <MenuItem icon={<IconShieldCheck />} onClick={go("/admin")}>Panel admina</MenuItem>}
        <MenuItem icon={<IconLogout />} destructive onClick={() => startTransition(() => { void signOutAction(); })}>Wyloguj</MenuItem>
      </MenuContent>
    </Menu>
  );
}
