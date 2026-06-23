"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SearchableDropdownOption {
  id: string;
  label: string;
  // Optional secondary line (smaller font, mono) — used for email / NIP / etc.
  sublabel?: string | null;
  // Optional left adornment: color swatch, avatar, or any node.
  leading?: ReactNode;
  // Searchable text — defaults to label + sublabel; override gdy chcesz dorzucić
  // alias (np. wyszukiwanie kontaktu po NIP nie pokazywanym jako sublabel).
  searchText?: string;
}

// Reusable dropdown z portal'em + search'em. Hidden input z podaną nazwą
// emituje wybrane ID, więc komponent gra jak natywny <select> w formularzu.
// Klient: native <select> w deal-form'ie nie pokazywał kolorów etapów /
// avatarów opiekunów / sub-labelów kontaktu (firma + osoba). Custom dropdown
// renderuje to wszystko + search filtr.
export function SearchableDropdown({
  name,
  value,
  onChange,
  options,
  placeholder = "Wybierz…",
  emptyLabel = "— bez wyboru —",
  required = false,
  disabled = false,
  allowClear = !required,
  searchPlaceholder = "Szukaj…",
  ariaLabel,
  invalid = false,
}: {
  name: string;
  value: string | null;
  // Optional — komponent działa też uncontrolled (state lokalny + hidden input).
  onChange?: (next: string) => void;
  options: SearchableDropdownOption[];
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  // Domyślnie zezwalamy na wyczyszczenie gdy pole nie jest required. Stage =
  // required, więc allowClear ustawia się na false automatycznie.
  allowClear?: boolean;
  searchPlaceholder?: string;
  ariaLabel?: string;
  // aria-invalid + border-destructive gdy true.
  invalid?: boolean;
}) {
  const [internal, setInternal] = useState<string | null>(value);
  const current = onChange ? value : internal;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [query, setQuery] = useState("");

  // External resync gdy parent zmieni `value` poza dropdown'em.
  useEffect(() => {
    setInternal(value);
  }, [value]);

  const recompute = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      setOpen(false);
      return;
    }
    const POP_W = Math.max(rect.width, 260);
    const GAP = 4;
    const PAD = 12;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - PAD;
    const spaceAbove = rect.top - GAP - PAD;
    const useBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - POP_W - 8),
    );
    if (useBelow) {
      setCoords({
        top: rect.bottom + GAP,
        left,
        width: POP_W,
        maxHeight: Math.max(200, spaceBelow),
      });
    } else {
      setCoords({
        bottom: window.innerHeight - rect.top + GAP,
        left,
        width: POP_W,
        maxHeight: Math.max(200, spaceAbove),
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    recompute();
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const setValue = (next: string | null) => {
    if (onChange) onChange(next ?? "");
    else setInternal(next);
  };

  const selected = useMemo(
    () => options.find((o) => o.id === current),
    [options, current],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    return options
      .filter((o) => {
        const haystack = (
          o.searchText ?? `${o.label} ${o.sublabel ?? ""}`
        ).toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 200);
  }, [options, query]);

  const triggerClass = invalid
    ? "border-destructive"
    : open
      ? "border-primary"
      : "border-border hover:border-primary/60";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-[0.9rem] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${triggerClass}`}
      >
        {selected?.leading && (
          <span className="shrink-0">{selected.leading}</span>
        )}
        <span
          className={`min-w-0 flex-1 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        {selected && allowClear && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setValue(null);
            }}
            aria-label="Wyczyść wybór"
            title="Wyczyść"
            className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={11} />
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Hidden input emitujący ID do form'a — handler typing="hidden" trzyma
          actual value, native required gate na form'a działa na non-empty. */}
      <input
        type="hidden"
        name={name}
        value={current ?? ""}
        required={required}
      />

      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            // Stop pointer events at capture phase — host dialog (base-ui)
            // ma outside-click handler, portal jest poza popup'em dialog'a.
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              ...(coords.top !== undefined
                ? { top: coords.top }
                : { bottom: coords.bottom }),
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className="z-[100] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            {options.length > 6 && (
              <div className="shrink-0 border-b border-border px-2.5 py-2">
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                  <Search size={11} className="text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="flex-1 bg-transparent text-[0.82rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            )}

            <ul
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            >
              {allowClear && !required && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(null);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.86rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {emptyLabel}
                  </button>
                </li>
              )}
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                  brak dopasowań
                </li>
              )}
              {filtered.map((o) => {
                const isCurrent = o.id === current;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => {
                        setValue(o.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                      data-active={isCurrent ? "true" : "false"}
                    >
                      {o.leading && (
                        <span className="shrink-0">{o.leading}</span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[0.88rem]">
                          {o.label}
                        </span>
                        {o.sublabel && (
                          <span className="truncate font-mono text-[0.62rem] text-muted-foreground/80">
                            {o.sublabel}
                          </span>
                        )}
                      </span>
                      {isCurrent && (
                        <Check size={12} className="shrink-0 text-primary" />
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
