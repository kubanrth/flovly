"use client";

// Inline assignee + tag pickers used as table cells. Click the
// cell → portal popover with searchable list → toggle item. Mirrors the
// task-detail modal UX so users don't have to open a task just to add a
// person or tag.

import { startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Tag as TagIcon } from "lucide-react";
import {
  toggleAssigneeAction,
  toggleTagAction,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export interface PickerMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface PickerTag {
  id: string;
  name: string;
  colorHex: string;
}

// Shared positioning logic. Anchors a fixed-position popover under the
// trigger element, flipping above when clipped, and capping height so it
// stays inside the viewport.
function computeCoords(
  trigger: HTMLElement,
  desiredWidth: number,
  desiredHeight = 320,
): { top: number; left: number; maxHeight: number; placement: "below" | "above" } {
  const r = trigger.getBoundingClientRect();
  const GAP = 6;
  const margin = 8;
  const spaceBelow = window.innerHeight - r.bottom - margin;
  const spaceAbove = r.top - margin;
  const placement: "below" | "above" =
    spaceBelow >= Math.min(desiredHeight, 200) || spaceBelow >= spaceAbove ? "below" : "above";
  const left = Math.min(
    Math.max(r.left, margin),
    window.innerWidth - desiredWidth - margin,
  );
  if (placement === "below") {
    const maxHeight = Math.min(desiredHeight, spaceBelow);
    return { top: r.bottom + GAP, left, maxHeight, placement };
  }
  const maxHeight = Math.min(desiredHeight, spaceAbove);
  return { top: Math.max(margin, r.top - GAP - maxHeight), left, maxHeight, placement };
}

type Coords = ReturnType<typeof computeCoords>;

// ─────────────────────────────────────────────────────────────────────
// Assignee picker
// ─────────────────────────────────────────────────────────────────────

export function AssigneePickerCell({
  taskId,
  current,
  members,
  canEdit,
}: {
  taskId: string;
  current: PickerMember[];
  members: PickerMember[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
    setQuery("");
  };

  const recompute = () => {
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
  };

  const onTriggerClick = () => {
    if (!canEdit) return;
    if (open) {
      close();
      return;
    }
    if (isMobile) {
      // Mobile: Sheet sam pozycjonuje, pomijamy computeCoords.
      setOpen(true);
      return;
    }
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
    setOpen(true);
  };

  useEffect(() => {
    // Mobile: Sheet ma własny outside-click/Escape.
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, isMobile]);

  const assignedIds = new Set(current.map((m) => m.id));
  const q = query.trim().toLowerCase();
  const filtered = members.filter((m) => {
    if (!q) return true;
    const n = (m.name ?? "").toLowerCase();
    return n.includes(q) || m.email.toLowerCase().includes(q);
  });

  const toggle = (userId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("userId", userId);
    startTransition(async () => {
      await toggleAssigneeAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        disabled={!canEdit}
        className="group/cell flex w-full items-center gap-1 rounded-md py-1 text-left transition-colors enabled:hover:bg-accent/40 disabled:cursor-default"
        aria-label={current.length === 0 ? "Przypisz osobę" : `Przypisanych: ${current.length}`}
      >
        {current.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70 group-hover/cell:text-foreground">
            <UserPlus size={11} className="opacity-60 group-hover/cell:opacity-100" />
            przypisz
          </span>
        ) : (
          <span className="flex -space-x-1.5">
            {current.slice(0, 4).map((a) => (
              <span
                key={a.id}
                title={a.name ?? a.email}
                className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (a.name ?? a.email).slice(0, 2).toUpperCase()
                )}
              </span>
            ))}
            {current.length > 4 && (
              <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-muted font-mono text-[0.58rem] text-muted-foreground">
                +{current.length - 4}
              </span>
            )}
          </span>
        )}
      </button>
      {open && coords && !isMobile && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 300,
              maxHeight: coords.maxHeight,
            }}
            className="popover-glass popover-enter shadow-aura z-[80] flex flex-col overflow-hidden p-2"
          >
            <div className="mb-1.5 shrink-0">
              <span className="eyebrow mb-1.5 block px-1.5 text-[0.66rem]">
                Przypisz
              </span>
              <div className="flex items-center gap-2 rounded-[8px] border border-border bg-card/60 px-2 py-1.5">
                <Search size={12} className="text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj osoby…"
                  className="flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Brak dopasowań
                </li>
              )}
              {filtered.map((m) => {
                const active = assignedIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      data-active={active}
                      className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-muted active:bg-primary/10 data-[active=true]:bg-primary/10"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-brand-gradient font-display text-[10px] font-bold text-white">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (m.name ?? m.email).slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {m.name ?? m.email.split("@")[0]}
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground/80">
                          @{m.email.split("@")[0]}
                        </span>
                      </span>
                      {active && (
                        <span
                          className="grid h-4 w-4 shrink-0 place-items-center text-primary"
                          aria-hidden="true"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {current.length > 0 && (
              <div className="mt-1 shrink-0 border-t border-border/60 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    // Toggle off każdego current — ten sam server action, raz na osobę.
                    current.forEach((m) => toggle(m.id));
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15"
                >
                  Zdejmij przypisanie
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Mobile: bottom sheet — przypisz osobę. Search input + lista 48px rows + sticky footer. */}
      {isMobile && (
        <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="sheet-mobile-surface max-h-[85dvh] gap-0 p-0"
          >
            <div className="flex max-h-[85dvh] flex-col">
              <div className="pt-3">
                <div className="sheet-drag-handle" aria-hidden="true" />
              </div>
              <div className="flex shrink-0 flex-col gap-2 px-4 pb-2">
                <SheetTitle className="text-base font-bold text-foreground">
                  Przypisz osobę
                </SheetTitle>
                <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card/60 px-2.5 py-2">
                  <Search size={13} className="text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj osoby…"
                    className="flex-1 bg-transparent text-[0.875rem] outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
                {filtered.length === 0 && (
                  <li className="px-2 py-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                    Brak dopasowań
                  </li>
                )}
                {filtered.map((m) => {
                  const active = assignedIds.has(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggle(m.id)}
                        data-active={active}
                        className="flex min-h-[48px] w-full items-center gap-3 rounded-[12px] px-3 text-left transition-colors active:bg-primary/15 data-[active=true]:bg-primary/10"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-brand-gradient font-display text-[11px] font-bold text-white">
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (m.name ?? m.email).slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-[14px] font-medium text-foreground">
                            {m.name ?? m.email.split("@")[0]}
                          </span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground/80">
                            @{m.email.split("@")[0]}
                          </span>
                        </span>
                        {active && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0 text-primary"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {current.length > 0 && (
                <div className="shrink-0 border-t border-border/60 px-3 pt-2 pb-safe-bottom">
                  <button
                    type="button"
                    onClick={() => {
                      current.forEach((m) => toggle(m.id));
                    }}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-medium text-destructive transition-colors active:bg-destructive/15"
                  >
                    Zdejmij przypisanie
                  </button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tag picker
// ─────────────────────────────────────────────────────────────────────

export function TagPickerCell({
  taskId,
  current,
  allTags,
  canEdit,
}: {
  taskId: string;
  current: PickerTag[];
  allTags: PickerTag[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
    setQuery("");
  };

  const recompute = () => {
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
  };

  const onTriggerClick = () => {
    if (!canEdit) return;
    if (open) {
      close();
      return;
    }
    if (isMobile) {
      setOpen(true);
      return;
    }
    if (!triggerRef.current) return;
    setCoords(computeCoords(triggerRef.current, 280, 360));
    setOpen(true);
  };

  useEffect(() => {
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, isMobile]);

  const tagIds = new Set(current.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const filtered = allTags.filter((t) => !q || t.name.toLowerCase().includes(q));

  const toggle = (tagId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("tagId", tagId);
    startTransition(async () => {
      await toggleTagAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        disabled={!canEdit}
        className="group/cell flex w-full items-center gap-1 rounded-md py-1 text-left transition-colors enabled:hover:bg-accent/40 disabled:cursor-default"
        aria-label={current.length === 0 ? "Dodaj tag" : `Tagów: ${current.length}`}
      >
        {current.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70 group-hover/cell:text-foreground">
            <TagIcon size={11} className="opacity-60 group-hover/cell:opacity-100" />
            dodaj tag
          </span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {current.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: t.colorHex }}
                />
                {t.name}
              </span>
            ))}
          </span>
        )}
      </button>
      {open && coords && !isMobile && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 280,
              maxHeight: coords.maxHeight,
            }}
            className="popover-glass popover-enter shadow-aura z-[80] flex flex-col overflow-hidden p-2"
          >
            <div className="mb-1.5 shrink-0">
              <span className="eyebrow mb-1.5 block px-1.5 text-[0.66rem]">
                Tagi
              </span>
              <div className="flex items-center gap-2 rounded-[8px] border border-border bg-card/60 px-2 py-1.5">
                <Search size={12} className="text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj tagu…"
                  className="flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {allTags.length === 0
                    ? "Brak tagów — utwórz przez modal zadania"
                    : "Brak dopasowań"}
                </li>
              )}
              {filtered.map((t) => {
                const active = tagIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      data-active={active}
                      className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-muted active:bg-primary/10 data-[active=true]:bg-primary/10"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: t.colorHex }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                        {t.name}
                      </span>
                      {active && (
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-primary"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {query.trim() &&
              allTags.length > 0 &&
              !allTags.some(
                (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
              ) && (
                <div className="mt-1 shrink-0 border-t border-border/60 pt-1">
                  <div
                    className="flex w-full items-center gap-2 rounded-[8px] border border-dashed border-primary/40 px-2 py-1.5 text-[13px] text-primary"
                    aria-hidden="true"
                    title="Stwórz tag przez modal zadania"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="truncate">
                      Stwórz &bdquo;{query.trim()}&rdquo;
                    </span>
                  </div>
                </div>
              )}
          </div>,
          document.body,
        )}

      {/* Mobile: bottom sheet — tagi. */}
      {isMobile && (
        <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="sheet-mobile-surface max-h-[85dvh] gap-0 p-0"
          >
            <div className="flex max-h-[85dvh] flex-col">
              <div className="pt-3">
                <div className="sheet-drag-handle" aria-hidden="true" />
              </div>
              <div className="flex shrink-0 flex-col gap-2 px-4 pb-2">
                <SheetTitle className="text-base font-bold text-foreground">
                  Tagi
                </SheetTitle>
                <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card/60 px-2.5 py-2">
                  <Search size={13} className="text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj tagu…"
                    className="flex-1 bg-transparent text-[0.875rem] outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-safe-bottom">
                {filtered.length === 0 && (
                  <li className="px-2 py-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {allTags.length === 0
                      ? "Brak tagów — utwórz przez modal zadania"
                      : "Brak dopasowań"}
                  </li>
                )}
                {filtered.map((t) => {
                  const active = tagIds.has(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggle(t.id)}
                        data-active={active}
                        className="flex min-h-[48px] w-full items-center gap-3 rounded-[12px] px-3 text-left transition-colors active:bg-primary/15 data-[active=true]:bg-primary/10"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: t.colorHex }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                          {t.name}
                        </span>
                        {active && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0 text-primary"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
