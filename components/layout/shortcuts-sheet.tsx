"use client";
import type { ReactElement } from "react";
import { Kbd, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

const ROWS: [string, string[]][] = [
  ["Paleta poleceń", ["⌘K"]],
  ["Nowe zadanie", ["C"]],
  ["Szukaj", ["/"]],
  ["Następne / poprzednie", ["J", "K"]],
  ["Otwórz zadanie", ["Enter"]],
  ["Zamknij panel", ["Esc"]],
  ["Zaznacz wiersz", ["X"]],
  ["Przypisz do mnie", ["M"]],
  ["Zmień status", ["S"]],
  ["Zmień priorytet", ["P"]],
];

// A3: 264px popover under the `?` button. `children` = trigger element.
export function ShortcutsSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactElement }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={children} />
      <PopoverContent data-ui="shortcuts-sheet" align="end" sideOffset={6} className="w-[264px] p-3.5">
        <div className="mb-2.5 text-sm font-semibold">Skróty klawiszowe</div>
        {ROWS.map(([label, keys]) => (
          <div key={label} className="flex h-[26px] items-center text-xs text-n-700">
            {label}
            <span className="ml-auto inline-flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
