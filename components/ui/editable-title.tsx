"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

// Inline-edit pattern dla nagłówków (h1/h2). Klik w tytuł
// (gdy canEdit=true) → input edycyjny w tym samym miejscu, Enter
// zapisuje, Escape lub blur z pustym polem cancel'uje, blur z value
// zapisuje. Optimistic UI: state lokalny zmienia się natychmiast,
// onCommit jest fire-and-forget w startTransition.
//
// Komponent jest visual-agnostic — parent dyktuje typografię przez
// className. Sam komponent dba tylko o click-to-edit affordance
// (subtle hover state + pencil icon) i o input/save logikę.
export function EditableTitle({
  value: initialValue,
  onCommit,
  canEdit = true,
  className = "",
  maxLength = 80,
  ariaLabel,
}: {
  value: string;
  onCommit: (newValue: string) => void | Promise<void>;
  canEdit?: boolean;
  className?: string;
  maxLength?: number;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync gdy prop się zmieni (np. po revalidatePath z innego okna).
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Auto-focus + select-all przy wejściu w edit mode.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === value) {
      // Brak zmian lub puste → revert do poprzedniego.
      setDraft(value);
      return;
    }
    setValue(next); // Optimistic update — UI nie czeka na server.
    startTransition(() => {
      void onCommit(next);
    });
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={maxLength}
        aria-label={ariaLabel ?? "Edytuj nazwę"}
        // Same typography as the heading (parent's className) — looks
        // like in-place edit, not a popup form. Border-bottom + bg-transparent
        // makes the input feel "lighter" than a regular form field.
        className={`${className} m-0 w-full border-0 border-b border-primary/60 bg-transparent px-0 py-0 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={!canEdit}
      aria-label={canEdit ? (ariaLabel ?? "Edytuj nazwę") : undefined}
      title={canEdit ? "Klik aby edytować" : undefined}
      // Explicit cursor-pointer — button inherits cursor:default from h1/h2 ancestors.
      className={`${className ?? ""} group inline-flex max-w-full items-center gap-2 rounded-sm text-left transition-colors disabled:cursor-default ${
        canEdit
          ? "cursor-pointer underline decoration-dotted decoration-foreground/0 underline-offset-[6px] hover:text-primary hover:decoration-primary/40 focus-visible:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          : ""
      }`}
    >
      <span className="truncate">{value}</span>
      {canEdit && (
        <Pencil
          size={14}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-50"
          aria-hidden
        />
      )}
    </button>
  );
}
