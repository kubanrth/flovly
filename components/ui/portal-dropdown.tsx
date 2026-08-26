"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Select } from "./select";

export interface PortalDropdownOption<V extends string = string> {
  value: V;
  label: string;
  prefix?: ReactNode;
  hint?: string;
  disabled?: boolean;
}

// Cienka nakładka na Select (zgodność ze starym API).
export function PortalDropdown<V extends string = string>({
  value, options, onChange, disabled, placeholder = "— wybierz —", ariaLabel, triggerClassName, width = 240, emptyHint,
}: {
  value: V | null | undefined;
  options: PortalDropdownOption<V>[];
  onChange: (next: V) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
  width?: number;
  emptyHint?: string;
}) {
  return (
    <Select<V>
      items={options.map((o) => ({
        value: o.value,
        icon: o.prefix,
        disabled: o.disabled,
        label: o.hint ? <>{o.label}<span className="ml-1 font-mono text-[10px] text-n-500">{o.hint}</span></> : o.label,
      }))}
      value={value ?? null}
      onValueChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn("min-w-[180px]", triggerClassName)}
      popupStyle={{ minWidth: width }}
      emptyText={emptyHint}
    />
  );
}
