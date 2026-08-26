"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconCheck, IconChevronDown } from "@/components/ui/icons";

// URL-synced workspace filter for the personal calendar: one dropdown with
// „Wszystkie przestrzenie" on top + the workspaces the user belongs to.
export function CalendarWorkspaceFilter({
  workspaces,
  selected,
}: {
  workspaces: { id: string; name: string }[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const pick = (val: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (val === "all") next.delete("workspace");
    else next.set("workspace", val);
    router.replace(next.toString() ? `?${next.toString()}` : "?");
  };

  const options = [{ id: "all", name: "Wszystkie przestrzenie" }, ...workspaces];
  const activeLabel = options.find((o) => o.id === selected)?.name ?? "Przestrzeń";

  return (
    <Menu>
      <MenuTrigger className="flex h-7 w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-medium text-n-700 outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]">
        <span className="min-w-0 flex-1 truncate text-left">{activeLabel}</span>
        <IconChevronDown width={11} height={11} strokeWidth={1.8} />
      </MenuTrigger>
      <MenuContent align="start">
        {options.map((o) => (
          <MenuItem key={o.id} onClick={() => pick(o.id)}>
            <span className="flex-1 truncate">{o.name}</span>
            {selected === o.id && <IconCheck width={13} height={13} className="text-orange-700" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
