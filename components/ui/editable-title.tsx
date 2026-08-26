"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IconEdit } from "./icons";

// Klik w tytuł → input w miejscu; Enter/blur zapisuje, Escape/puste cofa. Optimistic.
export function EditableTitle({
  value: initialValue, onCommit, canEdit = true, className = "", maxLength = 80, ariaLabel,
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
  const [prev, setPrev] = useState(initialValue);
  if (initialValue !== prev) {
    setPrev(initialValue);
    setValue(initialValue);
  }
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === value) return setDraft(value);
    setValue(next);
    startTransition(() => { void onCommit(next); });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }}
        maxLength={maxLength}
        aria-label={ariaLabel ?? "Edytuj nazwę"}
        className={cn(className, "m-0 w-full min-w-0 rounded-none border-0 border-b border-orange-500 bg-transparent px-0 py-0 outline-none focus-visible:shadow-none")}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { if (canEdit) { setDraft(value); setEditing(true); } }}
      disabled={!canEdit}
      aria-label={canEdit ? (ariaLabel ?? "Edytuj nazwę") : undefined}
      title={canEdit ? "Klik aby edytować" : undefined}
      className={cn(className, "group -mx-1 inline-flex max-w-full items-center gap-2 rounded-sm px-1 text-left outline-none disabled:cursor-default", canEdit && "cursor-pointer hover:bg-n-100")}
    >
      <span className="truncate">{value}</span>
      {canEdit && <IconEdit width={14} height={14} className="shrink-0 text-n-500 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
    </button>
  );
}
