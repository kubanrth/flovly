"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

// Reusable portal-rendered dropdown. Wszystkie native <select>
// w danielosie wyglądają jak Windows-95 (zwłaszcza dark mode), nie
// matchują brand'u i nie mają hover/focus parity z resztą UI. Ten
// komponent renderuje custom button-trigger + portal-popover z items'ami,
// keyboard nav (Up/Down/Enter/Escape), outside-click close i jest spójny
// w obu motywach.
//
// Generic na typie value, więc można używać z stringami albo enumami.

export interface PortalDropdownOption<V extends string = string> {
  value: V;
  label: string;
  // Opcjonalny dodatkowy element przed labelem (kolorowa kropka, ikona).
  prefix?: ReactNode;
  // Opcjonalny opis pod label'em — pokazuje się mniejszy, drugą linią.
  hint?: string;
  disabled?: boolean;
}

export function PortalDropdown<V extends string = string>({
  value,
  options,
  onChange,
  disabled,
  placeholder = "— wybierz —",
  ariaLabel,
  triggerClassName,
  width = 240,
  emptyHint,
}: {
  value: V | null | undefined;
  options: PortalDropdownOption<V>[];
  onChange: (next: V) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  // Override trigger styling. Default = uniform 36-px h, rounded-md, border.
  triggerClassName?: string;
  // Min popover width (px). Trigger width takes priority if larger.
  width?: number;
  // Pokaz tej notki gdy options.length === 0.
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? null;

  // Position popover beneath trigger via fixed coords.
  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      // If trigger scrolls out of view, close instead of stranding popover.
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const popWidth = Math.max(width, r.width);
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - popWidth - 8,
      );
      setCoords({
        top: r.bottom + 6,
        left,
        width: popWidth,
      });
    };
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, width]);

  // Outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const enabledIdxs = options
        .map((o, i) => (o.disabled ? -1 : i))
        .filter((i) => i >= 0);
      if (enabledIdxs.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const cur = enabledIdxs.indexOf(highlighted);
        const next = cur < 0 ? enabledIdxs[0] : enabledIdxs[(cur + 1) % enabledIdxs.length];
        setHighlighted(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const cur = enabledIdxs.indexOf(highlighted);
        const prev =
          cur < 0
            ? enabledIdxs[enabledIdxs.length - 1]
            : enabledIdxs[(cur - 1 + enabledIdxs.length) % enabledIdxs.length];
        setHighlighted(prev);
      } else if (e.key === "Enter" && highlighted >= 0) {
        e.preventDefault();
        const opt = options[highlighted];
        if (opt && !opt.disabled) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, highlighted, options, onChange]);

  // Reset highlight to current selection on open.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlighted(idx);
    }
  }, [open, options, value]);

  const defaultTriggerClass =
    "inline-flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? defaultTriggerClass}
      >
        {current ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {current.prefix}
            <span className="truncate">{current.label}</span>
          </span>
        ) : (
          <span className="flex-1 truncate text-left text-muted-foreground">
            {placeholder}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 100,
            }}
            className="overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <ul className="max-h-[280px] overflow-y-auto p-1">
              {options.length === 0 && (
                <li className="px-2 py-1.5 text-[0.78rem] text-muted-foreground">
                  {emptyHint ?? "Brak opcji"}
                </li>
              )}
              {options.map((opt, i) => {
                const selected = opt.value === value;
                const hot = highlighted === i;
                return (
                  <li key={opt.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.86rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        hot ? "bg-accent" : ""
                      } ${selected ? "font-medium text-foreground" : "text-foreground"}`}
                    >
                      {opt.prefix && (
                        <span className="shrink-0">{opt.prefix}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {opt.label}
                        {opt.hint && (
                          <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check size={13} className="shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
