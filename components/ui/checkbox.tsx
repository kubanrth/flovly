"use client";

import { Check, Minus } from "lucide-react";
import type { ChangeEvent, MouseEvent } from "react";

// Tabela używała natywnego <input type="checkbox"> z accent-color,
// który w dark mode zachowuje się jak Windows-95 (jasne tło, brak hover'u,
// brak indeterminate). Ten komponent renderuje appearance-none input +
// overlay z lucide ikonką żeby wyglądało jednakowo w light/dark, support'owało
// indeterminate i miało porządne hover/focus stany.
export function Checkbox({
  checked,
  indeterminate,
  onChange,
  onClick,
  ariaLabel,
  size = "md",
  disabled,
  className,
  name,
  value,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onClick?: (e: MouseEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  // Native form integration. Gdy 'name' jest set, underlying
  // input wysyła "on" przez FormData (zachowanie natywnego checkboxa) —
  // formy z action={...} dostają standardowy submit.
  name?: string;
  value?: string;
}) {
  const px = size === "sm" ? 14 : 16;
  const dim =
    size === "sm" ? "h-[14px] w-[14px]" : "h-[16px] w-[16px]";
  return (
    <span
      className={`relative inline-grid place-items-center align-middle ${dim} ${className ?? ""}`}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onChange={onChange}
        onClick={onClick}
        className={`peer ${dim} cursor-pointer appearance-none rounded-[4px] border border-border bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background`}
      />
      {/* Check zawsze w DOM, widoczność przez peer-checked TRANSITION (nie
          keyframe): brak popu przy mount'cie tabeli z N zaznaczonymi wierszami,
          a szybkie klikanie płynnie zawraca animację zamiast ją kolejkować.
          Easing spójny z toast-in (cubic-bezier(0.22,1,0.36,1), bounce 0). */}
      <Check
        size={px - 4}
        strokeWidth={3.5}
        className="pointer-events-none absolute scale-50 text-primary-foreground opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] peer-checked:scale-100 peer-checked:opacity-100"
      />
      {indeterminate && !checked && (
        <Minus
          size={px - 4}
          strokeWidth={3.5}
          className="pointer-events-none absolute text-primary-foreground"
        />
      )}
    </span>
  );
}
