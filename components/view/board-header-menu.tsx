"use client";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconEdit, IconLink, IconMore } from "@/components/ui/icons";

// ⋯ in the board header's breadcrumb row (A2).
export function BoardHeaderMenu({ canEditName }: { canEditName: boolean }) {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="sm" iconOnly aria-label="Więcej opcji tablicy" />}>
        <IconMore />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<IconLink />} onClick={() => void navigator.clipboard.writeText(window.location.href)}>
          Kopiuj link do tablicy
        </MenuItem>
        {canEditName && (
          <MenuItem
            icon={<IconEdit />}
            // Deferred so the menu's focus-return doesn't steal focus from the title input.
            onClick={() => setTimeout(() => document.querySelector<HTMLButtonElement>("[data-ui=board-name] button")?.click(), 50)}
          >
            Zmień nazwę
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
