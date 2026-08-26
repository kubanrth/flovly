"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedProps<V extends string> {
  options: { value: V; label: ReactNode }[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

const H = { sm: "h-6", md: "h-7", lg: "h-8" } as const;

export function Segmented<V extends string>({ options, value, onChange, size = "sm", className, ...rest }: SegmentedProps<V>) {
  return (
    <div role="radiogroup" aria-label={rest["aria-label"]} className={cn("inline-flex gap-0.5 rounded-md bg-n-100 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("inline-flex items-center whitespace-nowrap rounded-sm border px-2.5 text-xs font-medium outline-none", H[size], on ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
