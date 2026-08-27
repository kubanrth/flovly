"use client";

import type { ReactNode } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "./avatar";
import { CheckMark } from "./checkbox";
import type { ChipHue } from "./chip";
import { IconCheck, IconChevronDown, IconClose, IconSearch } from "./icons";
import { inputVariants } from "./input";
import { POPUP_CLASS, POPUP_ITEM_CLASS } from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  avatar?: string | null;
  hue?: ChipHue;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | string[] | null;
  onValueChange?: (value: string | string[] | null) => void;
  multi?: boolean;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  emptyText?: ReactNode;
}

const same = (a: ComboboxOption, b: ComboboxOption) => a.value === b.value;
const toLabel = (o: ComboboxOption) => o.label;

function OptionRow({ o }: { o: ComboboxOption }) {
  return (
    <>
      {(o.avatar !== undefined || o.hue) && <Avatar name={o.label} src={o.avatar} hue={o.hue} size={20} />}
      <span className="truncate">{o.label}</span>
    </>
  );
}

export function Combobox({ options, value, onValueChange, multi, placeholder = "Szukaj…", size = "md", disabled, name, id, className, emptyText = "Brak wyników" }: ComboboxProps) {
  const selected = multi
    ? options.filter((o) => (Array.isArray(value) ? value : []).includes(o.value))
    : (options.find((o) => o.value === value) ?? null);
  return (
    <ComboboxPrimitive.Root
      items={options}
      multiple={multi}
      value={selected}
      onValueChange={(v) => onValueChange?.(multi ? (v as ComboboxOption[]).map((o) => o.value) : ((v as ComboboxOption | null)?.value ?? null))}
      itemToStringLabel={toLabel}
      isItemEqualToValue={same}
      disabled={disabled}
      name={name}
    >
      <ComboboxPrimitive.Chips className={cn(inputVariants({ size }), "flex h-auto min-h-8 flex-wrap items-center gap-1 py-1 focus-within:border-orange-500 focus-within:shadow-[var(--focus)] has-[:disabled]:pointer-events-none has-[:disabled]:bg-n-100", className)}>
        {multi && (selected as ComboboxOption[]).map((o) => (
          <ComboboxPrimitive.Chip key={o.value} className="inline-flex h-[22px] items-center gap-1 rounded-sm bg-n-100 pr-1 pl-0.5 text-xs">
            {o.avatar !== undefined || o.hue ? <Avatar name={o.label} src={o.avatar} hue={o.hue} size={20} className="!size-[18px] !text-[9px]" /> : <span className="pl-1" />}
            {o.label}
            <ComboboxPrimitive.ChipRemove aria-label="Usuń" className="inline-flex size-3.5 items-center justify-center rounded-[2px] text-fg-3 hover:text-foreground"><IconClose width={10} height={10} strokeWidth={1.6} /></ComboboxPrimitive.ChipRemove>
          </ComboboxPrimitive.Chip>
        ))}
        <ComboboxPrimitive.Input id={id} placeholder={placeholder} className="h-6 min-w-16 flex-1 bg-transparent outline-none placeholder:text-fg-3 focus-visible:shadow-none" />
        <ComboboxPrimitive.Trigger tabIndex={-1} aria-label="Rozwiń listę" className="ml-auto shrink-0 text-muted-foreground"><IconChevronDown width={12} height={12} /></ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.Chips>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} align="start" className="z-[100] outline-none">
          <ComboboxPrimitive.Popup className={cn(POPUP_CLASS, "w-[260px] max-h-(--available-height) overflow-y-auto p-1")}>
            <ComboboxPrimitive.Empty className="px-2 py-2 text-xs text-fg-3 empty:hidden">{emptyText}</ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(o: ComboboxOption) => (
                <ComboboxPrimitive.Item key={o.value} value={o} disabled={o.disabled} className={cn(POPUP_ITEM_CLASS, "data-selected:font-medium")}>
                  <OptionRow o={o} />
                  <ComboboxPrimitive.ItemIndicator className="ml-auto text-success"><IconCheck width={14} height={14} /></ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export interface Person {
  id: string;
  name: string;
  avatar?: string | null;
  hue?: ChipHue;
}

export interface PersonPickerProps {
  people: Person[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  // AK190: rola `combobox` bierze nazwę tylko od autora (name from author),
  // więc treść triggera — awatary, sr-only „Dodaj osobę" — jej nie tworzy.
  label?: string;
}

const samePerson = (a: Person, b: Person) => a.id === b.id;
const personLabel = (p: Person) => p.name;

// B2: checkbox + awatar + imię, input szukania w środku popovera (260px).
export function PersonPicker({ people, value, onValueChange, placeholder = "Szukaj osoby…", disabled, className, children, label = "Przypisane osoby" }: PersonPickerProps) {
  const selected = people.filter((p) => value.includes(p.id));
  return (
    <ComboboxPrimitive.Root items={people} multiple value={selected} onValueChange={(v) => onValueChange(v.map((p) => p.id))} itemToStringLabel={personLabel} isItemEqualToValue={samePerson} disabled={disabled}>
      <ComboboxPrimitive.Trigger aria-label={label} className={cn("inline-flex h-8 items-center gap-1.5 rounded-sm border border-input-border bg-card px-2 text-sm text-left outline-none hover:border-input-border-hover data-popup-open:border-orange-500", className)}>
        {children ?? (selected.length ? <AvatarStack people={selected} size={20} max={5} /> : <span className="text-fg-3">Dodaj osobę…</span>)}
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} align="start" className="z-[100] outline-none">
          <ComboboxPrimitive.Popup className={cn(POPUP_CLASS, "w-[260px] p-1.5")}>
            <div className="mb-1 flex h-[30px] items-center gap-1.5 rounded-sm border border-input-border px-2 focus-within:border-orange-500">
              <IconSearch width={12} height={12} className="shrink-0 text-fg-3" />
              <ComboboxPrimitive.Input placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-fg-3 focus-visible:shadow-none" />
            </div>
            <ComboboxPrimitive.Empty className="px-2 py-2 text-xs text-fg-3 empty:hidden">Brak osób</ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-[240px] overflow-y-auto">
              {(p: Person) => (
                <ComboboxPrimitive.Item key={p.id} value={p} className={cn(POPUP_ITEM_CLASS, "group text-muted-foreground data-selected:text-foreground")}>
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-n-400 bg-card text-white group-data-selected:border-control-on group-data-selected:bg-control-on">
                    <CheckMark className="hidden group-data-selected:block" />
                  </span>
                  <Avatar name={p.name} src={p.avatar} hue={p.hue} size={20} />
                  <span className="truncate">{p.name}</span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
