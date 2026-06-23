"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ALL_FIELD_TYPES,
  COMPUTED_FIELD_TYPES,
  FIELD_TYPE_META,
  SELECT_PALETTE,
  type FieldOptions,
  type FieldType,
  type SelectOption,
} from "@/lib/table-fields";

export function FieldTypePicker({
  value,
  onChange,
  disabled,
  // Computed types are still selectable in the picker (for future), but
  // disabled here while we don't yet implement them in cells.
  showComputed = false,
}: {
  value: FieldType;
  onChange: (next: FieldType) => void;
  disabled?: boolean;
  showComputed?: boolean;
}) {
  const types = showComputed
    ? ALL_FIELD_TYPES
    : ALL_FIELD_TYPES.filter((t) => !COMPUTED_FIELD_TYPES.has(t));
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {types.map((t) => {
        const meta = FIELD_TYPE_META[t];
        const Icon = meta.icon;
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            disabled={disabled}
            title={meta.description}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors disabled:opacity-60 ${
              active
                ? "border-primary bg-primary/8 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Icon size={14} className={active ? "text-primary" : ""} />
            <span className="truncate text-[0.78rem] font-medium">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SelectOptionsEditor({
  value,
  onChange,
}: {
  value: SelectOption[];
  onChange: (next: SelectOption[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.some((o) => o.value === v)) return;
    const color = SELECT_PALETTE[value.length % SELECT_PALETTE.length];
    onChange([...value, { value: v, color }]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1">
        {value.map((opt, idx) => (
          <li
            key={`${opt.value}-${idx}`}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1"
          >
            <ColorSwatch
              color={opt.color}
              onPick={(c) => {
                const next = [...value];
                next[idx] = { ...opt, color: c };
                onChange(next);
              }}
            />
            <input
              value={opt.value}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...opt, value: e.target.value };
                onChange(next);
              }}
              className="flex-1 min-w-0 bg-transparent text-[0.82rem] outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Usuń opcję"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={11} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 transition-colors focus-within:border-primary/60">
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
          className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Dodaj opcję"
          title="Dodaj opcję (Enter)"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

function ColorSwatch({
  color,
  onPick,
}: {
  color: string;
  onPick: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Zmień kolor"
        className="block h-4 w-4 rounded-full ring-1 ring-foreground/10"
        style={{ background: color }}
      />
      {open && (
        <>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 grid grid-cols-4 gap-1 rounded-md border border-border bg-popover p-1.5 shadow-md">
            {SELECT_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                className="h-5 w-5 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function NumberFormatPicker({
  value,
  onChange,
}: {
  value: FieldOptions;
  onChange: (next: FieldOptions) => void;
}) {
  const fmt = value.numberFormat ?? "decimal";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1">
        {(["integer", "decimal", "currency", "percent"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange({ ...value, numberFormat: f })}
            className={`rounded-md border px-2 py-1 text-[0.74rem] font-medium transition-colors ${
              fmt === f
                ? "border-primary bg-primary/8 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "integer"
              ? "Liczba całk."
              : f === "decimal"
                ? "Dziesiętna"
                : f === "currency"
                  ? "Waluta"
                  : "Procent"}
          </button>
        ))}
      </div>
      {fmt === "currency" && (
        <label className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
          Waluta
          <input
            value={value.numberCurrency ?? "PLN"}
            onChange={(e) =>
              onChange({ ...value, numberCurrency: e.target.value.toUpperCase().slice(0, 4) })
            }
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-[0.78rem] uppercase text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      )}
      {(fmt === "decimal" || fmt === "currency" || fmt === "percent") && (
        <label className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
          Miejsca po przecinku
          <input
            type="number"
            min={0}
            max={6}
            value={value.numberPrecision ?? 2}
            onChange={(e) =>
              onChange({ ...value, numberPrecision: Math.max(0, Math.min(6, Number(e.target.value))) })
            }
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[0.78rem] text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      )}
    </div>
  );
}

export function DateFormatPicker({
  value,
  onChange,
}: {
  value: FieldOptions;
  onChange: (next: FieldOptions) => void;
}) {
  const includeTime = value.dateIncludeTime ?? false;
  return (
    <label className="flex items-center gap-2 text-[0.78rem] text-muted-foreground">
      <input
        type="checkbox"
        checked={includeTime}
        onChange={(e) => onChange({ ...value, dateIncludeTime: e.target.checked })}
        className="h-3.5 w-3.5 accent-[var(--primary)]"
      />
      Pokazuj godzinę
    </label>
  );
}

export function RatingMaxPicker({
  value,
  onChange,
}: {
  value: FieldOptions;
  onChange: (next: FieldOptions) => void;
}) {
  const max = value.ratingMax ?? 5;
  return (
    <label className="flex items-center gap-2 text-[0.78rem] text-muted-foreground">
      Maks. ocena
      <input
        type="number"
        min={3}
        max={10}
        value={max}
        onChange={(e) =>
          onChange({ ...value, ratingMax: Math.max(3, Math.min(10, Number(e.target.value))) })
        }
        className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[0.78rem] text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </label>
  );
}

// Compose the right configuration sub-control(s) for a given type.
export function FieldOptionsEditor({
  type,
  value,
  onChange,
}: {
  type: FieldType;
  value: FieldOptions;
  onChange: (next: FieldOptions) => void;
}) {
  switch (type) {
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return (
        <SelectOptionsEditor
          value={value.selectOptions ?? []}
          onChange={(opts) => onChange({ ...value, selectOptions: opts })}
        />
      );
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
