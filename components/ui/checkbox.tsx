"use client";

import type { ChangeEvent, MouseEventHandler } from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@/lib/utils";

export function CheckMark({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <path d="M1.8 5.4l2.2 2.2 4.2-4.8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SIZE = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;
const MARK = { sm: 9, md: 10, lg: 12 } as const;

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onCheckedChange?: CheckboxPrimitive.Root.Props["onCheckedChange"];
  onClick?: MouseEventHandler<HTMLElement>;
  ariaLabel?: string;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
  id?: string;
}

export function Checkbox({ checked, indeterminate, onChange, onCheckedChange, onClick, ariaLabel, size = "md", disabled, className, name, value, id }: CheckboxProps) {
  const mixed = !!indeterminate && !checked;
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      indeterminate={mixed}
      disabled={disabled}
      name={name}
      value={value}
      aria-label={ariaLabel}
      onClick={onClick}
      onCheckedChange={(next, details) => {
        onCheckedChange?.(next, details);
        // ponytail: legacy onChange(e) dostaje tylko currentTarget/target.checked — tyle czytają call-site'y.
        onChange?.({ currentTarget: { checked: next }, target: { checked: next } } as unknown as ChangeEvent<HTMLInputElement>);
      }}
      className={cn(
        // The visible box stays 14–20px, but the pseudo-element pushes the hit
        // area out to at least 24px (WCAG 2.5.8 target size). Without it the
        // control was a 16px tap target and screens had to swap in native
        // inputs to pass their button-height audit.
        "relative inline-flex shrink-0 items-center justify-center rounded-sm border-[1.5px] border-n-400 bg-card align-middle text-white outline-none hover:border-n-500",
        "before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        "data-checked:border-control-on data-checked:bg-control-on data-indeterminate:border-control-on data-indeterminate:bg-control-on",
        "data-disabled:border-n-200 data-disabled:bg-n-100 data-disabled:text-n-400",
        SIZE[size],
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {mixed ? <span className="h-0.5 w-2 rounded-[1px] bg-current" /> : <CheckMark size={MARK[size]} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
