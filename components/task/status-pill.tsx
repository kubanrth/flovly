"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface StatusOption {
  id: string;
  name: string;
  colorHex: string;
}

// Custom pill-style status selector — replaces the native <select> in
// task-detail so statuses render with their actual brand color and the
// dropdown matches the app's design language. Keeps the hidden <input>
// so react-hook-form / native forms see the new value.
export function StatusPill({
  name,
  form,
  statuses,
  defaultValue,
  disabled,
  onCommit,
}: {
  name: string;
  // HTML5 `form` attribute — associates the hidden input with a form by id
  // even when the component is rendered outside the form's DOM subtree.
  // Used by task-detail.tsx to keep status in a sticky meta sidebar while
  // the submit lives in a separate footer button.
  form?: string;
  statuses: StatusOption[];
  defaultValue: string | null;
  disabled?: boolean;
  // When provided, we auto-submit the enclosing form on change. Mirrors
  // the "instant save" pattern used by milestone select.
  onCommit?: (value: string) => void;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = statuses.find((s) => s.id === value) ?? null;

  // Click-outside close. Keyboard ESC also closes.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickValue = (v: string) => {
    setValue(v);
    setOpen(false);
    onCommit?.(v);
  };

  const colorHex = active?.colorHex ?? "#94A3B8";

  return (
    <div ref={rootRef} className="relative w-fit">
      <input type="hidden" name={name} value={value} form={form} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: active ? `${colorHex}22` : "transparent",
          color: active ? colorHex : "var(--muted-foreground)",
          borderColor: active ? `${colorHex}55` : "var(--border)",
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: colorHex }}
          aria-hidden
        />
        <span className="truncate">{active?.name ?? "— brak —"}</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_rgba(10,10,40,0.25)]"
        >
          <PillOption
            label="— brak —"
            colorHex="#94A3B8"
            active={value === ""}
            onClick={() => pickValue("")}
          />
          {statuses.map((s) => (
            <PillOption
              key={s.id}
              label={s.name}
              colorHex={s.colorHex}
              active={value === s.id}
              onClick={() => pickValue(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PillOption({
  label,
  colorHex,
  active,
  onClick,
}: {
  label: string;
  colorHex: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      style={{ color: colorHex }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: colorHex }}
      />
      <span className="flex-1 truncate">{label}</span>
      {active && <Check size={12} className="shrink-0 opacity-60" />}
    </button>
  );
}
