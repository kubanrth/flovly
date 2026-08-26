"use client";

import { useState, type ReactNode } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";
import { IconCheck, IconChevronDown, IconClose, IconSearch } from "./icons";
import { inputVariants } from "./input";
import { POPUP_CLASS, POPUP_ITEM_CLASS } from "./popover";

export interface SearchableDropdownOption {
  id: string;
  label: string;
  // Druga linia (mono) — e-mail / NIP itp.
  sublabel?: string | null;
  // Element przed labelem: kropka koloru, avatar, ikona.
  leading?: ReactNode;
  // Tekst do filtrowania (domyślnie label + sublabel).
  searchText?: string;
}

const EMPTY_ID = "";
const same = (a: SearchableDropdownOption, b: SearchableDropdownOption) => a.id === b.id;
const toLabel = (o: SearchableDropdownOption) => o.label;
const filter = (o: SearchableDropdownOption, q: string) => (o.searchText ?? `${o.label} ${o.sublabel ?? ""}`).toLowerCase().includes(q.trim().toLowerCase());

// Dropdown z wyszukiwarką; hidden input `name` emituje wybrane ID do formularza.
export function SearchableDropdown({
  name, value, onChange, options, placeholder = "Wybierz…", emptyLabel = "— bez wyboru —", required = false, disabled = false,
  allowClear = !required, searchPlaceholder = "Szukaj…", ariaLabel, invalid = false,
}: {
  name: string;
  value: string | null;
  onChange?: (next: string) => void;
  options: SearchableDropdownOption[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  searchPlaceholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [internal, setInternal] = useState<string | null>(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setInternal(value);
  }
  const current = onChange ? value : internal;
  const setValue = (next: string | null) => (onChange ? onChange(next ?? "") : setInternal(next));
  const selected = options.find((o) => o.id === current) ?? null;
  const items = allowClear && !required ? [{ id: EMPTY_ID, label: emptyLabel }, ...options] : options;

  return (
    <ComboboxPrimitive.Root
      items={items}
      value={selected}
      onValueChange={(o) => setValue(o && o.id !== EMPTY_ID ? o.id : null)}
      itemToStringLabel={toLabel}
      isItemEqualToValue={same}
      filter={filter}
      disabled={disabled}
    >
      <ComboboxPrimitive.Trigger
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(inputVariants({ size: "md" }), "flex items-center gap-2 text-left data-popup-open:border-orange-500")}
      >
        {selected?.leading && <span className="shrink-0">{selected.leading}</span>}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-n-500")}>{selected ? selected.label : placeholder}</span>
        {selected && allowClear && !disabled && (
          <span role="button" tabIndex={-1} aria-label="Wyczyść wybór" onClick={(e) => { e.stopPropagation(); setValue(null); }} className="inline-flex size-4 shrink-0 items-center justify-center rounded-[2px] text-n-500 hover:text-foreground">
            <IconClose width={11} height={11} />
          </span>
        )}
        <IconChevronDown width={12} height={12} className="shrink-0 text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <input type="hidden" name={name} value={current ?? ""} required={required} />
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} align="start" className="z-[100] outline-none">
          <ComboboxPrimitive.Popup className={cn(POPUP_CLASS, "w-(--anchor-width) min-w-[260px] p-1")}>
            <div className="mb-1 flex h-[30px] items-center gap-1.5 rounded-sm border border-input-border px-2 focus-within:border-orange-500">
              <IconSearch width={12} height={12} className="shrink-0 text-n-500" />
              <ComboboxPrimitive.Input placeholder={searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-n-500 focus-visible:shadow-none" />
            </div>
            <ComboboxPrimitive.Empty className="px-2 py-2 text-center text-xs text-n-500 empty:hidden">brak dopasowań</ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-[280px] overflow-y-auto">
              {(o: SearchableDropdownOption) => (
                <ComboboxPrimitive.Item key={o.id} value={o} className={cn(POPUP_ITEM_CLASS, "h-auto min-h-8 py-1", o.id === EMPTY_ID && "text-muted-foreground")}>
                  {o.leading && <span className="shrink-0">{o.leading}</span>}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate">{o.label}</span>
                    {o.sublabel && <span className="truncate font-mono text-[10px] text-n-500">{o.sublabel}</span>}
                  </span>
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
