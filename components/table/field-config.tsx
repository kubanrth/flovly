"use client";

import { useState } from "react";
import {
  ALL_FIELD_TYPES,
  COMPUTED_FIELD_TYPES,
  FIELD_TYPE_META,
  SELECT_PALETTE,
  type FieldOptions,
  type FieldType,
  type SelectOption,
} from "@/lib/table-fields";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { FieldTypeIcon } from "@/components/table/field-icons";

export function FieldTypePicker({
  value,
  onChange,
  disabled,
  showComputed = false,
}: {
  value: FieldType;
  onChange: (next: FieldType) => void;
  disabled?: boolean;
  showComputed?: boolean;
}) {
  const types = showComputed ? ALL_FIELD_TYPES : ALL_FIELD_TYPES.filter((t) => !COMPUTED_FIELD_TYPES.has(t));
  return (
    <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Typ pola">
      {types.map((t) => {
        const meta = FIELD_TYPE_META[t];
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            disabled={disabled}
            title={meta.description}
            className={cn(
              "flex h-7 items-center gap-2 rounded-md border px-2 text-left text-xs font-medium outline-none disabled:opacity-60",
              active ? "border-orange-500 bg-selected text-foreground" : "border-border text-muted-foreground hover:bg-n-100 hover:text-foreground active:bg-n-200",
            )}
          >
            <FieldTypeIcon type={t} size={13} className="shrink-0" />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SelectOptionsEditor({ value, onChange }: { value: SelectOption[]; onChange: (next: SelectOption[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || value.some((o) => o.value === v)) return;
    onChange([...value, { value: v, color: SELECT_PALETTE[value.length % SELECT_PALETTE.length] }]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-1">
      {value.map((opt, idx) => (
        <div key={idx} className="flex h-8 items-center gap-2 rounded-sm border border-border px-1.5">
          <ColorSwatch color={opt.color} onPick={(c) => onChange(value.map((o, i) => (i === idx ? { ...o, color: c } : o)))} />
          <input
            value={opt.value}
            onChange={(e) => onChange(value.map((o, i) => (i === idx ? { ...o, value: e.target.value } : o)))}
            aria-label="Nazwa opcji"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none"
          />
          <Button variant="ghost" size="sm" iconOnly aria-label="Usuń opcję" onClick={() => onChange(value.filter((_, i) => i !== idx))}>
            <IconTrash />
          </Button>
        </div>
      ))}
      <div className="flex h-8 items-center gap-1.5 rounded-sm border border-dashed border-n-400 px-1.5 focus-within:border-orange-500">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Dodaj opcję…"
          aria-label="Nowa opcja"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none"
        />
        <Button variant="ghost" size="sm" iconOnly aria-label="Dodaj opcję" disabled={!draft.trim()} onClick={add}>
          <IconPlus />
        </Button>
      </div>
    </div>
  );
}

function ColorSwatch({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="Zmień kolor" className="block size-4 shrink-0 rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)]" style={{ background: color }} />
      <PopoverContent className="grid grid-cols-4 gap-1.5 p-2">
        {SELECT_PALETTE.map((c) => (
          <button key={c} type="button" aria-label={`Kolor ${c}`} onClick={() => onPick(c)} className={cn("size-5 rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)]", c === color && "shadow-[0_0_0_2px_var(--n-900)]")} style={{ background: c }} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

const NUMBER_FORMATS = [
  { value: "integer", label: "Całkowita" },
  { value: "decimal", label: "Dziesiętna" },
  { value: "currency", label: "Waluta" },
  { value: "percent", label: "Procent" },
] as const;

export function NumberFormatPicker({ value, onChange }: { value: FieldOptions; onChange: (next: FieldOptions) => void }) {
  const fmt = value.numberFormat ?? "decimal";
  return (
    <div className="flex flex-col gap-2">
      <Segmented options={[...NUMBER_FORMATS]} value={fmt} onChange={(f) => onChange({ ...value, numberFormat: f as FieldOptions["numberFormat"] })} />
      {fmt === "currency" && (
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Waluta
          <Input size="sm" value={value.numberCurrency ?? "PLN"} onChange={(e) => onChange({ ...value, numberCurrency: e.target.value.toUpperCase().slice(0, 4) })} className="w-20 uppercase" />
        </label>
      )}
      {fmt !== "integer" && (
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Miejsca po przecinku
          <Input size="sm" type="number" min={0} max={6} value={value.numberPrecision ?? 2} onChange={(e) => onChange({ ...value, numberPrecision: Math.max(0, Math.min(6, Number(e.target.value))) })} className="w-16" />
        </label>
      )}
    </div>
  );
}

export function DateFormatPicker({ value, onChange }: { value: FieldOptions; onChange: (next: FieldOptions) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Checkbox size="sm" checked={value.dateIncludeTime ?? false} onCheckedChange={(c) => onChange({ ...value, dateIncludeTime: c === true })} />
      Pokazuj godzinę
    </label>
  );
}

export function RatingMaxPicker({ value, onChange }: { value: FieldOptions; onChange: (next: FieldOptions) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      Maks. ocena
      <Input size="sm" type="number" min={3} max={10} value={value.ratingMax ?? 5} onChange={(e) => onChange({ ...value, ratingMax: Math.max(3, Math.min(10, Number(e.target.value))) })} className="w-16" />
    </label>
  );
}

// Compose the right configuration sub-control(s) for a given type.
export function FieldOptionsEditor({ type, value, onChange }: { type: FieldType; value: FieldOptions; onChange: (next: FieldOptions) => void }) {
  switch (type) {
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return <SelectOptionsEditor value={value.selectOptions ?? []} onChange={(opts) => onChange({ ...value, selectOptions: opts })} />;
    case "NUMBER":
      return <NumberFormatPicker value={value} onChange={onChange} />;
    case "DATE":
      return <DateFormatPicker value={value} onChange={onChange} />;
    case "RATING":
      return <RatingMaxPicker value={value} onChange={onChange} />;
    default:
      return null;
  }
}
