"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Customizable sidebar items (A3). Keys are stable — persisted in localStorage.
export const FOR_YOU_ITEMS = [
  { key: "inbox", label: "Powiadomienia" },
  { key: "my-tasks", label: "Zadania dla Ciebie" },
  { key: "todo", label: "TO DO" },
  { key: "calendar", label: "Kalendarz" },
  { key: "notes", label: "Notatnik" },
  { key: "reminders", label: "Przypomnienia" },
  { key: "vacations", label: "Urlopy" },
] as const;

export const TOOL_ITEMS = [
  { key: "contacts", label: "Kontakty" },
  { key: "sales", label: "Plan sprzedaży" },
  { key: "time", label: "Czas pracy" },
  { key: "passwords", label: "Hasła" },
  { key: "subscriptions", label: "Subskrypcje" },
  { key: "briefs", label: "Creative Board" },
  { key: "support", label: "Support" },
  { key: "wiki", label: "Wiki" },
  { key: "canvases", label: "Whiteboardy" },
] as const;

export type ForYouKey = (typeof FOR_YOU_ITEMS)[number]["key"];
export type ToolKey = (typeof TOOL_ITEMS)[number]["key"];

export const SIDEBAR_ITEMS_PREF = "ui:sidebar-items";
export interface SidebarItemsPref {
  hidden: string[];
}

// A3 grid reads column-wise: left = Dla Ciebie, right = Narzędzia.
const GRID: { key: string; label: string }[] = [];
for (let i = 0; i < Math.max(FOR_YOU_ITEMS.length, TOOL_ITEMS.length); i++) {
  if (FOR_YOU_ITEMS[i]) GRID.push(FOR_YOU_ITEMS[i]);
  if (TOOL_ITEMS[i]) GRID.push(TOOL_ITEMS[i]);
}

// Pref is owned by <Sidebar> (same-tab sync); the dialog only edits a draft.
export function CustomizeSidebarDialog({ open, onOpenChange, hidden, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; hidden: string[]; onSave: (hidden: string[]) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ui="customize-sidebar-dialog" className="sm:max-w-[520px]">
        {open && (
          <Body
            hidden={hidden}
            onCancel={() => onOpenChange(false)}
            onSave={(next) => {
              onSave(next);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while open → draft state always starts from the saved pref.
function Body({ hidden, onCancel, onSave }: { hidden: string[]; onCancel: () => void; onSave: (hidden: string[]) => void }) {
  const [draft, setDraft] = useState(() => new Set(hidden));
  const toggle = (key: string, on: boolean) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Dostosuj pasek boczny</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="mb-3 text-xs text-muted-foreground">
          Wybierz pozycje widoczne w sekcjach „Dla Ciebie” i „Narzędzia”. Zmiany dotyczą tylko Twojego konta.
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          {GRID.map((item) => {
            const on = !draft.has(item.key);
            return (
              <label key={item.key} className={cn("flex h-8 cursor-pointer items-center gap-2.5 text-sm", on ? "text-foreground" : "text-muted-foreground")}>
                <Checkbox checked={on} onCheckedChange={(next) => toggle(item.key, !!next)} ariaLabel={item.label} />
                {item.label}
              </label>
            );
          })}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>Anuluj</Button>
        <Button onClick={() => onSave([...draft])}>Zapisz</Button>
      </DialogFooter>
    </>
  );
}
