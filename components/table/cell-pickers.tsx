"use client";

// Inline assignee + tag pickers (Lista cells). Click → popover (bottom sheet
// <768px) with search → toggle. Mirrors the task-panel UX.

import { startTransition, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createTagAction, toggleAssigneeAction, toggleTagAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { TAG_PALETTE } from "@/lib/colors";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckMark } from "@/components/ui/checkbox";
import { TagChip } from "@/components/ui/chip";
import { InputGroup } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { memberName } from "@/components/table/types";

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

const TRIGGER = "flex h-7 w-full min-w-0 items-center rounded-sm px-1 text-left outline-none enabled:hover:bg-n-100 disabled:cursor-default data-popup-open:bg-n-100";

// Popover on desktop, bottom sheet on mobile — same body.
function CellPopover({ open, onOpenChange, disabled, ariaLabel, title, trigger, children }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  disabled: boolean;
  ariaLabel: string;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        <button type="button" disabled={disabled} aria-label={ariaLabel} onClick={() => onOpenChange(true)} className={TRIGGER}>{trigger}</button>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
            <div className="sheet-drag-handle" aria-hidden="true" />
            <SheetTitle className="px-4 pb-2 pt-3 text-base font-semibold">{title}</SheetTitle>
            <div className="safe-bottom max-h-[70dvh] overflow-y-auto px-3 pb-3">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger disabled={disabled} aria-label={ariaLabel} className={TRIGGER}>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-1.5">{children}</PopoverContent>
    </Popover>
  );
}

function OptionRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="option" aria-selected={active} onClick={onClick} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-n-100 focus-visible:bg-n-100">
      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-n-400 bg-card text-white", active && "border-control-on bg-control-on")}>
        {active && <CheckMark />}
      </span>
      {children}
    </button>
  );
}

export function AssigneePickerCell({ taskId, current, members, canEdit }: { taskId: string; current: PickerMember[]; members: PickerMember[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Optimistic toggles until the refreshed row lands (reset when props change).
  const [optimistic, setOptimistic] = useState(current);
  const [prev, setPrev] = useState(current);
  if (prev !== current) {
    setPrev(current);
    setOptimistic(current);
  }
  const assigned = new Set(optimistic.map((m) => m.id));
  const q = query.trim().toLowerCase();
  const filtered = members.filter((m) => !q || (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  const toggle = (userId: string) => {
    setOptimistic((cur) => (cur.some((m) => m.id === userId) ? cur.filter((m) => m.id !== userId) : [...cur, members.find((m) => m.id === userId)!].filter(Boolean)));
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("userId", userId);
    startTransition(async () => {
      await toggleAssigneeAction(fd);
      router.refresh();
    });
  };
  return (
    <CellPopover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      disabled={!canEdit}
      ariaLabel={optimistic.length === 0 ? "Przypisz osobę" : `Przypisanych: ${optimistic.length}`}
      title="Przypisz osobę"
      trigger={optimistic.length === 0 ? <span className="text-n-400">—</span> : <AvatarStack people={optimistic.map((a) => ({ name: memberName(a), src: a.avatarUrl }))} size={22} max={3} />}
    >
      <InputGroup size="sm" leading={<IconSearch />} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj osoby…" aria-label="Szukaj osoby" className="mb-1 text-xs" />
      <div role="listbox" aria-label="Osoby" className="flex max-h-[280px] flex-col overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-fg-3">Brak dopasowań</p>}
        {filtered.map((m) => (
          <OptionRow key={m.id} active={assigned.has(m.id)} onClick={() => toggle(m.id)}>
            <Avatar name={memberName(m)} src={m.avatarUrl} size={20} />
            <span className="min-w-0 flex-1 truncate">{memberName(m)}</span>
          </OptionRow>
        ))}
      </div>
      {optimistic.length > 0 && (
        <div className="mt-1 border-t border-n-100 pt-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-danger-text hover:text-danger-text" onClick={() => optimistic.forEach((m) => toggle(m.id))}>
            Zdejmij przypisanie
          </Button>
        </div>
      )}
    </CellPopover>
  );
}

export function TagPickerCell({ taskId, workspaceId, current, allTags, canEdit }: { taskId: string; workspaceId?: string; current: PickerTag[]; allTags: PickerTag[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [optimistic, setOptimistic] = useState(current);
  const [prev, setPrev] = useState(current);
  if (prev !== current) {
    setPrev(current);
    setOptimistic(current);
  }
  const has = new Set(optimistic.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const filtered = allTags.filter((t) => !q || t.name.toLowerCase().includes(q));
  const toggle = (tagId: string) => {
    setOptimistic((cur) => (cur.some((t) => t.id === tagId) ? cur.filter((t) => t.id !== tagId) : [...cur, allTags.find((t) => t.id === tagId)!].filter(Boolean)));
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("tagId", tagId);
    startTransition(async () => {
      await toggleTagAction(fd);
      router.refresh();
    });
  };
  const canCreate = Boolean(workspaceId) && q.length > 0 && !allTags.some((t) => t.name.toLowerCase() === q);
  const create = () => {
    if (!workspaceId || creating) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", query.trim());
    fd.set("colorHex", TAG_PALETTE[allTags.length % TAG_PALETTE.length]!);
    setCreating(true);
    startTransition(async () => {
      await createTagAction(fd);
      setCreating(false);
      setQuery("");
      router.refresh();
    });
  };
  return (
    <CellPopover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      disabled={!canEdit}
      ariaLabel={optimistic.length === 0 ? "Dodaj tag" : `Tagów: ${optimistic.length}`}
      title="Tagi"
      trigger={
        optimistic.length === 0 ? (
          <span className="text-n-400">—</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
            {optimistic.map((t) => <TagChip key={t.id} label={t.name} hue={hueForColor(t.colorHex)} size="sm" />)}
          </span>
        )
      }
    >
      <InputGroup size="sm" leading={<IconSearch />} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj tagu…" aria-label="Szukaj tagu" className="mb-1 text-xs" />
      <div role="listbox" aria-label="Tagi" className="flex max-h-[280px] flex-col overflow-y-auto">
        {filtered.length === 0 && !canCreate && <p className="px-2 py-3 text-center text-xs text-fg-3">{allTags.length === 0 ? "Brak tagów" : "Brak dopasowań"}</p>}
        {filtered.map((t) => (
          <OptionRow key={t.id} active={has.has(t.id)} onClick={() => toggle(t.id)}>
            <TagChip label={t.name} hue={hueForColor(t.colorHex)} size="sm" />
          </OptionRow>
        ))}
      </div>
      {canCreate && (
        <div className="mt-1 border-t border-n-100 pt-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-link" loading={creating} onClick={create}>
            <IconPlus />
            Stwórz „{query.trim()}”
          </Button>
        </div>
      )}
    </CellPopover>
  );
}
