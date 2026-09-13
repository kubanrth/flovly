"use client";

// F15: edytor kategorii tablicy pod przyciskiem „Kategorie" na Liście.
// Wiersze idą po `id`, nie po pozycji — skasowanie środkowego wiersza nie może
// przemianować sąsiadów (tak działał edytor opcji pola wyboru).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { ColorSwatch } from "@/components/table/field-config";
import { SELECT_PALETTE } from "@/lib/colors";

export interface CategoryDraft { id?: string; name: string; colorHex: string }

export function CategoriesEditor({ value, onChange }: { value: CategoryDraft[]; onChange: (next: CategoryDraft[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name || value.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, { name, colorHex: SELECT_PALETTE[value.length % SELECT_PALETTE.length]! }]);
    setDraft("");
  };
  const patch = (idx: number, p: Partial<CategoryDraft>) => onChange(value.map((c, i) => (i === idx ? { ...c, ...p } : c)));
  return (
    <div className="flex flex-col gap-1">
      {value.map((c, idx) => (
        <div key={c.id ?? `new-${idx}`} className="flex h-8 items-center gap-2 rounded-sm border border-border px-1.5">
          <ColorSwatch color={c.colorHex} onPick={(colorHex) => patch(idx, { colorHex })} />
          <input
            value={c.name}
            onChange={(e) => patch(idx, { name: e.target.value })}
            aria-label="Nazwa kategorii"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none"
          />
          <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń kategorię ${c.name}`} onClick={() => onChange(value.filter((_, i) => i !== idx))}>
            <IconTrash />
          </Button>
        </div>
      ))}
      <div className="flex h-8 items-center gap-1.5 rounded-sm border border-dashed border-n-400 px-1.5 focus-within:border-orange-500">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Dodaj kategorię…"
          aria-label="Nowa kategoria"
          maxLength={60}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none"
        />
        <Button variant="ghost" size="sm" iconOnly aria-label="Dodaj kategorię" disabled={!draft.trim()} onClick={add}>
          <IconPlus />
        </Button>
      </div>
    </div>
  );
}
