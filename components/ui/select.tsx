"use client";

import type { CSSProperties, ReactNode } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@/lib/utils";
import { IconCheck, IconChevronDown } from "./icons";
import { inputVariants } from "./input";
import { POPUP_CLASS, POPUP_ITEM_CLASS } from "./popover";

export interface SelectItem<V extends string = string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<V extends string = string> {
  items: SelectItem<V>[];
  value?: V | null;
  defaultValue?: V | null;
  onValueChange?: (value: V) => void;
  placeholder?: ReactNode;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
  className?: string;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  emptyText?: ReactNode;
}

export function Select<V extends string = string>({
  items, value, defaultValue, onValueChange, placeholder = "Wybierz…", size = "md", disabled, required, invalid, name, id, className, popupClassName, popupStyle, emptyText, ...rest
}: SelectProps<V>) {
  return (
    <SelectPrimitive.Root
      items={items.map((i) => ({ value: i.value, label: i.label }))}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => { if (v != null) onValueChange?.(v as V); }}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={rest["aria-label"]}
        aria-invalid={invalid || undefined}
        className={cn(inputVariants({ size }), "flex select-none items-center justify-between gap-2 text-left data-placeholder:text-n-500 data-popup-open:border-orange-500", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {(v: V | null) => {
            const it = items.find((i) => i.value === v);
            return it ? <>{it.icon}<span className="truncate">{it.label}</span></> : placeholder;
          }}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground"><IconChevronDown width={12} height={12} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} align="start" alignItemWithTrigger={false} className="z-[100] outline-none">
          <SelectPrimitive.Popup className={cn(POPUP_CLASS, "max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto p-1", popupClassName)} style={popupStyle}>
            {items.length === 0 && <div className="px-2 py-1.5 text-xs text-n-500">{emptyText ?? "Brak opcji"}</div>}
            <SelectPrimitive.List>
              {items.map((i) => (
                <SelectPrimitive.Item key={i.value} value={i.value} disabled={i.disabled} className={cn(POPUP_ITEM_CLASS, "data-selected:font-medium")}>
                  <SelectPrimitive.ItemText className="flex min-w-0 flex-1 items-center gap-2">{i.icon}<span className="truncate">{i.label}</span></SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ml-auto text-success"><IconCheck width={14} height={14} /></SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
