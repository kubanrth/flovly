"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconEdit, IconLink, IconMore, IconImage } from "@/components/ui/icons";

// Board background tints (A2). Warm, low-chroma — the header keeps its own
// text colours, so these stay light enough for `--foreground` to pass AA.
const TINTS: { label: string; value: string | null }[] = [
  { label: "Brak", value: null },
  { label: "Piaskowe", value: "#FAF7F2" },
  { label: "Pomarańczowe", value: "#FFF4EE" },
  { label: "Miętowe", value: "#F0F7F3" },
  { label: "Błękitne", value: "#F0F4FA" },
  { label: "Liliowe", value: "#F5F1FA" },
  { label: "Różowe", value: "#FBF0F3" },
];

// ponytail: per-device via localStorage — Board has no background column and
// F3 may not touch the schema (MAP: „bez zmian schematu"). Upgrade path when a
// `Board.backgroundColor` field lands: swap these two helpers for a server action.
const key = (boardId: string) => `flovly:boardBg:${boardId}`;

function paint(color: string | null) {
  const el = document.querySelector<HTMLElement>("[data-ui=board-header]");
  if (!el) return;
  if (color) el.style.backgroundColor = color;
  else el.style.removeProperty("background-color");
}

// ⋯ in the board header's breadcrumb row (A2).
export function BoardHeaderMenu({ boardId, canEditName }: { boardId: string; canEditName: boolean }) {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key(boardId));
    } catch {
      // Private mode / storage disabled — the board just stays untinted.
    }
    paint(saved);
    return () => paint(null);
  }, [boardId]);

  const choose = (color: string | null) => {
    paint(color);
    try {
      if (color) localStorage.setItem(key(boardId), color);
      else localStorage.removeItem(key(boardId));
    } catch {
      // Nothing to do — the colour still applies for this session.
    }
  };

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
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger icon={<IconImage />}>Tło</MenuSubTrigger>
          <MenuSubContent data-ui="board-background-menu">
            {TINTS.map((t) => (
              <MenuItem key={t.label} onClick={() => choose(t.value)}>
                <span
                  aria-hidden
                  className="mr-2 inline-block size-3.5 shrink-0 rounded-sm border border-border align-middle"
                  style={t.value ? { backgroundColor: t.value } : undefined}
                />
                {t.label}
              </MenuItem>
            ))}
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
