"use client";

import { startTransition, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createTagAction, patchTaskAction, toggleAssigneeAction, toggleTagAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { assignTaskToMilestoneAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { FieldCell } from "@/components/table/field-cells";
import { parseFieldOptions, type FieldType } from "@/lib/table-fields";
import { TAG_PALETTE } from "@/lib/colors";
import { useUiPref } from "@/hooks/use-ui-pref";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckMark } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { PersonPicker } from "@/components/ui/combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input, InputGroup } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IconCheck, IconPlus, IconRoadmap, IconSearch, IconStar, IconStarFilled } from "@/components/ui/icons";
import { TaskTimer } from "@/components/task/task-timer";
import { RecurrencePicker, summarizeRule, type RecurrenceRule } from "@/components/task/recurrence-picker";
import { hueForColor } from "@/components/ui/status-hue";
import { formatDayTime, formatStamp } from "@/components/task/format";
import type { TaskMeta } from "@/components/task/task-detail-reads";
import type { TaskViewMode } from "@/components/task/task-shell-context";

export interface Member { id: string; name: string | null; email: string; avatarUrl: string | null }
export interface Tag { id: string; name: string; colorHex: string }

export interface TaskDetailsProps {
  mode: TaskViewMode;
  mobile?: boolean;
  workspaceId: string;
  task: {
    id: string; milestoneId: string | null; startAt: string | null; stopAt: string | null; reminderAt: string | null; reminderOffset: string | null;
    recurrenceRule: RecurrenceRule | null; recurrenceParentId: string | null; timeTrackedSeconds: number; timerStartedAt: string | null; timerCompletedAt: string | null;
  };
  milestones: { id: string; title: string }[];
  allMembers: Member[];
  assigneeIds: Set<string>;
  allTags: Tag[];
  tagIds: Set<string>;
  canEdit: boolean;
  customColumns: { id: string; name: string; type: FieldType; options: unknown }[];
  customValues: Record<string, string>;
  meta: TaskMeta | null;
  lastActor: string | null;
  onMutate?: () => void;
}

type Row = { key: string; label: string; empty: boolean; node: ReactNode };

const NONE = "__none__";
const memberName = (m: Member) => m.name ?? m.email.split("@")[0]!;

function useRows(p: TaskDetailsProps): Row[] {
  const { task, mode, mobile } = p;
  const timerEmpty = task.timeTrackedSeconds === 0 && !task.timerStartedAt && !task.timerCompletedAt;
  const rows: Row[] = [
    { key: "assignees", label: "Przypisani", empty: p.assigneeIds.size === 0, node: <AssigneesField {...p} /> },
    ...(mode === "panel" && !mobile
      ? [
          { key: "start", label: "Start", empty: !task.startAt, node: <DatesField {...p} only="startAt" /> },
          { key: "stop", label: "Koniec", empty: !task.stopAt, node: <DatesField {...p} only="stopAt" /> },
        ]
      : [{ key: "dates", label: "Start · Koniec", empty: !task.startAt && !task.stopAt, node: <DatesField {...p} /> }]),
    { key: "milestone", label: "Milestone", empty: !task.milestoneId, node: <MilestoneField {...p} /> },
    { key: "tags", label: "Tagi", empty: p.tagIds.size === 0, node: <TagsField {...p} /> },
    { key: "reminder", label: "Przypomnienie", empty: !task.reminderAt, node: <ReminderField {...p} /> },
    { key: "recurrence", label: "Cykliczność", empty: !task.recurrenceRule && !task.recurrenceParentId, node: <RecurrenceField {...p} /> },
    { key: "timer", label: "Timer", empty: timerEmpty, node: <TaskTimer taskId={task.id} accumulatedSeconds={task.timeTrackedSeconds} startedAt={task.timerStartedAt} completedAt={task.timerCompletedAt} canEdit={p.canEdit} variant={mobile ? "mobile" : "details"} /> },
    ...p.customColumns.map((col) => ({
      key: `custom-${col.id}`,
      label: col.name,
      empty: !(p.customValues[col.id] ?? ""),
      node: <div className="-mx-1 min-h-7 text-sm"><FieldCell taskId={task.id} columnId={col.id} type={col.type} raw={p.customValues[col.id] ?? ""} options={parseFieldOptions(col.options)} disabled={!p.canEdit} /></div>,
    })),
    { key: "views", label: "Widoki", empty: (p.meta?.views.length ?? 0) === 0, node: <ViewsField views={p.meta?.views ?? []} /> },
  ];
  return rows;
}

// Desktop right column — 204 (panel) / 300 (modal) / 280 (page). Every row inline-editable, pinnable; „Ukryj puste pola".
export function TaskDetailsColumn(p: TaskDetailsProps) {
  const rows = useRows(p);
  const [hideEmpty, setHideEmpty] = useUiPref<boolean>("ui:hide-empty", false);
  const [pinned, setPinned] = useUiPref<string[]>("ui:pinned-fields", []);
  const togglePin = (key: string) => setPinned(pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key]);
  const customStart = rows.findIndex((r) => r.key.startsWith("custom-"));
  const visible = rows.filter((r) => !(hideEmpty && r.empty) || pinned.includes(r.key));
  const ordered = [...visible.filter((r) => pinned.includes(r.key)), ...visible.filter((r) => !pinned.includes(r.key))];
  const firstCustom = customStart >= 0 ? rows[customStart]!.key : null;
  const w = p.mode === "page" ? "w-[280px] p-5" : p.mode === "modal" ? "w-[300px] p-4" : "w-[204px] p-3";
  const canvas = p.mode !== "panel";

  return (
    <aside className={cn("shrink-0 overflow-y-auto border-l", canvas ? "border-border bg-canvas" : "border-n-100 bg-card", w)} data-ui="task-details">
      <div className="eyebrow mb-3">Szczegóły</div>
      {ordered.map((r) => (
        <div key={r.key} className="group/row mb-3">
          {r.key === firstCustom && !pinned.includes(r.key) && <div className="mb-2 border-t border-n-100 pt-2.5 text-2xs font-semibold text-fg-3">Pola dodatkowe</div>}
          <div className="mb-1 flex items-center gap-1 text-2xs text-fg-3">
            {r.label}
            <button type="button" onClick={() => togglePin(r.key)} aria-label={pinned.includes(r.key) ? `Odepnij pole ${r.label}` : `Przypnij pole ${r.label}`}
              className={cn("ml-auto grid size-4 place-items-center rounded-[2px] text-n-400 outline-none hover:text-foreground", !pinned.includes(r.key) && "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100")}>
              {pinned.includes(r.key) ? <IconStarFilled width={11} height={11} className="text-orange-500" /> : <IconStar width={11} height={11} />}
            </button>
          </div>
          {r.node}
        </div>
      ))}
      {customStart < 0 && !hideEmpty && (
        <div className="mb-3"><div className="mb-2 border-t border-n-100 pt-2.5 text-2xs font-semibold text-fg-3">Pola dodatkowe</div><span className="text-sm text-fg-3">Brak</span></div>
      )}
      {p.meta && (
        <div className={cn("border-t pt-2.5", canvas ? "border-table-grid" : "border-n-100")}>
          <div className="text-2xs text-fg-3">Utworzono</div>
          <div className="mb-1.5 font-mono text-2xs text-n-600">{formatStamp(p.meta.createdAt)} · {p.meta.creatorName}</div>
          <div className="text-2xs text-fg-3">Zaktualizowano</div>
          <div className="font-mono text-2xs text-n-600">{formatStamp(p.meta.updatedAt)}{p.lastActor ? ` · ${p.lastActor}` : ""}</div>
        </div>
      )}
      <label className={cn("mt-3 flex items-center gap-2 border-t pt-2.5 text-xs text-n-600", canvas ? "border-table-grid" : "border-n-100")}>
        <Switch size="sm" checked={hideEmpty} onCheckedChange={(v) => setHideEmpty(!!v)} aria-label="Ukryj puste pola" />
        Ukryj puste pola
      </label>
    </aside>
  );
}

// Mobile: bordered 8px card, 44px rows (B2-mobile).
export function TaskDetailsCard(p: TaskDetailsProps) {
  const rows = useRows({ ...p, mobile: true });
  return (
    <div className="my-3 rounded-lg border border-border" data-ui="task-details">
      {rows.map((r) => (
        <div key={r.key} className="flex min-h-11 items-center gap-2 border-b border-n-100 px-3 py-1.5 last:border-b-0">
          <span className="w-24 shrink-0 text-xs text-fg-3">{r.label}</span>
          <div className="flex min-w-0 flex-1 items-center">{r.node}</div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── fields ───────────── */

function AssigneesField({ task, allMembers, assigneeIds, canEdit, mode, mobile }: TaskDetailsProps) {
  const router = useRouter();
  const people = allMembers.map((m) => ({ id: m.id, name: memberName(m), avatar: m.avatarUrl }));
  const active = allMembers.filter((m) => assigneeIds.has(m.id));
  const onChange = (ids: string[]) => {
    const next = new Set(ids);
    const changed = allMembers.filter((m) => next.has(m.id) !== assigneeIds.has(m.id));
    if (changed.length === 0) return;
    startTransition(async () => {
      for (const m of changed) {
        const fd = new FormData();
        fd.set("taskId", task.id);
        fd.set("userId", m.id);
        await toggleAssigneeAction(fd);
      }
      router.refresh(); // realtime broadcast can fail silently
    });
  };
  const listNames = mode === "page" && !mobile;
  return (
    <div data-field="assignees" className="flex items-center">
      <PersonPicker people={people} value={active.map((m) => m.id)} onValueChange={onChange} disabled={!canEdit} className="h-auto gap-1.5 border-transparent bg-transparent px-0 hover:border-transparent data-popup-open:border-transparent">
        {listNames ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {active.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5"><Avatar name={memberName(m)} src={m.avatarUrl} size={22} /><span className="text-sm">{memberName(m)}</span></span>)}
            {active.length === 0 && <span className="text-sm text-fg-3">Brak</span>}
          </span>
        ) : (
          <AvatarStack people={active.map((m) => ({ name: memberName(m), src: m.avatarUrl }))} size={22} max={3} />
        )}
        {canEdit && (
          <span className={cn("grid size-[22px] place-items-center rounded-full border border-dashed border-n-400 text-fg-3", active.length > 0 && !listNames && "ml-0.5")}>
            <IconPlus width={12} height={12} /><span className="sr-only">Dodaj osobę</span>
          </span>
        )}
      </PersonPicker>
    </div>
  );
}

function DatesField({ task, canEdit, onMutate, only, mobile }: TaskDetailsProps & { only?: "startAt" | "stopAt" }) {
  const save = (field: "startAt" | "stopAt") => (iso: string) => {
    if (!canEdit) return;
    onMutate?.();
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set(field, iso);
    startTransition(() => patchTaskAction(fd));
  };
  const start = <DateTimePicker name="startAt" defaultValue={task.startAt} disabled={!canEdit} label="Data startu" variant="cell" onChange={save("startAt")} />;
  const stop = <DateTimePicker name="stopAt" defaultValue={task.stopAt} disabled={!canEdit} label="Data końca" variant="cell" onChange={save("stopAt")} />;
  if (only) return <div className="-mx-2 text-sm">{only === "startAt" ? start : stop}</div>;
  if (mobile) return <div className="-mx-2 flex w-full flex-col text-sm">{start}{stop}</div>;
  return (
    <div className="-mx-2 flex items-center gap-0.5 text-sm">
      <div className="min-w-0 flex-1">{start}</div>
      <span className="shrink-0 text-fg-3">→</span>
      <div className="min-w-0 flex-1">{stop}</div>
    </div>
  );
}

function MilestoneField({ task, milestones, canEdit }: TaskDetailsProps) {
  const router = useRouter();
  const [value, setValue] = useState(task.milestoneId ?? NONE);
  const [prev, setPrev] = useState(task.milestoneId);
  if (task.milestoneId !== prev) { setPrev(task.milestoneId); setValue(task.milestoneId ?? NONE); }
  const change = (next: string) => {
    const previous = value;
    setValue(next);
    const fd = new FormData();
    fd.set("taskId", task.id);
    fd.set("milestoneId", next === NONE ? "" : next);
    startTransition(async () => {
      const result = await assignTaskToMilestoneAction(fd);
      if (result && !result.ok) { setValue(previous); alert(result.error); return; } // task dates outside milestone range
      router.refresh();
    });
  };
  return (
    <div className="-mx-1">
      <Select
        aria-label="Wybierz milestone"
        value={value}
        onValueChange={change}
        disabled={!canEdit}
        emptyText="Utwórz milestone w roadmapie"
        className="h-7 border-transparent bg-transparent px-1 hover:border-input-border data-popup-open:border-orange-500"
        items={[
          { value: NONE, label: <span className="text-fg-3">— brak —</span> },
          ...milestones.map((m) => ({ value: m.id, label: m.title, icon: <IconRoadmap width={13} height={13} className="shrink-0 text-n-600" /> })),
        ]}
      />
    </div>
  );
}

function TagsField({ workspaceId, task, allTags, tagIds, canEdit, mobile }: TaskDetailsProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState(TAG_PALETTE[0]!);
  const active = allTags.filter((t) => tagIds.has(t.id));
  const q = query.trim().toLowerCase();
  const filtered = q ? allTags.filter((t) => t.name.toLowerCase().includes(q)) : allTags;
  const toggle = (tagId: string) => {
    const fd = new FormData();
    fd.set("taskId", task.id);
    fd.set("tagId", tagId);
    startTransition(async () => { await toggleTagAction(fd); router.refresh(); });
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {active.map((t) => <Chip key={t.id} hue={hueForColor(t.colorHex)} size="sm" onRemove={canEdit ? () => toggle(t.id) : undefined}>{t.name}</Chip>)}
      {active.length === 0 && !canEdit && <span className="text-sm text-fg-3">Brak</span>}
      {canEdit && (
        <Popover onOpenChange={(o) => { if (!o) { setQuery(""); setCreating(false); } }}>
          {/* Kwadracik ma 18px, więc na telefonie powiększamy samo pole dotyku
              nakładką — wygląd zostaje zgodny z makietą. */}
          <PopoverTrigger aria-label="Dodaj tag" title="Dodaj tag" className={cn("grid size-[18px] place-items-center rounded-sm border border-dashed border-n-400 text-fg-3 outline-none hover:border-n-500 hover:text-foreground", mobile && "relative before:absolute before:-inset-[13px] before:content-['']")}>
            <IconPlus width={11} height={11} />
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-1.5">
            <InputGroup leading={<IconSearch />} size="sm" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj tagu…" aria-label="Szukaj tagu" className="mb-1" />
            <ul className="flex max-h-[200px] flex-col overflow-y-auto">
              {filtered.length === 0 && <li className="px-2 py-2 text-xs text-fg-3">{allTags.length === 0 ? "Brak tagów w przestrzeni." : "Brak dopasowań"}</li>}
              {filtered.map((t) => {
                const on = tagIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(t.id)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-n-100">
                      <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border-[1.5px] bg-card text-white", on ? "border-control-on bg-control-on" : "border-n-400")}><CheckMark className={on ? "block" : "hidden"} /></span>
                      <Chip hue={hueForColor(t.colorHex)} dot size="sm">{t.name}</Chip>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 border-t border-n-100 pt-1">
              {creating ? (
                <form action={createTagAction} onSubmit={() => { setCreating(false); setColor(TAG_PALETTE[0]!); }} className="flex flex-col gap-1.5 p-1">
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="colorHex" value={color} />
                  <Input name="name" required maxLength={32} placeholder="Nazwa tagu" autoFocus size="sm" aria-label="Nazwa nowego tagu" />
                  <div className="flex items-center gap-1">
                    {TAG_PALETTE.map((c) => (
                      <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Kolor ${c}`} aria-pressed={color === c}
                        className={cn("size-4 rounded-full outline-none", color === c && "ring-2 ring-control-on ring-offset-1")} style={{ background: c }} />
                    ))}
                    <Button type="submit" size="sm" iconOnly aria-label="Utwórz tag" className="ml-auto size-6"><IconCheck /></Button>
                  </div>
                </form>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="w-full justify-start text-link"><IconPlus /> Nowy tag{q ? ` „${query.trim()}"` : ""}</Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

const REMINDER_PRESETS: { value: string; label: string }[] = [
  { value: "1h", label: "1 h" }, { value: "4h", label: "4 h" }, { value: "1d", label: "1 dzień" }, { value: "3d", label: "3 dni" }, { value: "none", label: "Brak" },
];

function ReminderField({ task, canEdit, onMutate, mobile }: TaskDetailsProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(task.reminderOffset ?? "none");
  const [prev, setPrev] = useState(task.reminderOffset);
  if (task.reminderOffset !== prev) { setPrev(task.reminderOffset); setValue(task.reminderOffset ?? "none"); }
  const pick = (v: string) => {
    setValue(v);
    setOpen(false);
    onMutate?.();
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("reminderOffset", v);
    startTransition(() => patchTaskAction(fd));
  };
  const label = task.reminderAt ? formatDayTime(task.reminderAt) : value !== "none" ? `${REMINDER_PRESETS.find((p) => p.value === value)?.label} przed terminem` : "Brak";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Na telefonie przycisk wypełnia cały 44px wiersz karty — sam tekst
          dawał pole dotyku wysokie na 20px. */}
      <PopoverTrigger disabled={!canEdit} aria-label="Przypomnienie" className={cn("-mx-1 rounded-sm px-1 text-left text-sm outline-none hover:bg-n-100 disabled:hover:bg-transparent", mobile && "flex min-h-11 w-full items-center", !task.reminderAt && value === "none" && "text-fg-3")}>{label}</PopoverTrigger>
      <PopoverContent className="w-[200px] p-1">
        <div className="eyebrow px-2 pt-1 pb-1">Przypomnij</div>
        <div role="radiogroup" aria-label="Czas przypomnienia" className="flex flex-col">
          {REMINDER_PRESETS.map((opt) => (
            <button key={opt.value} type="button" role="radio" aria-checked={value === opt.value} onClick={() => pick(opt.value)}
              className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-n-100", value === opt.value ? "font-medium" : "text-n-600")}>
              <span aria-hidden className={cn("size-3.5 rounded-full border bg-card", value === opt.value ? "border-[4.5px] border-control-on" : "border-[1.5px] border-n-400")} />
              {opt.label}
            </button>
          ))}
        </div>
        {!task.stopAt && <p className="px-2 pt-1 pb-1 text-2xs text-fg-3">Ustaw datę końca, żeby przypomnienie miało termin.</p>}
      </PopoverContent>
    </Popover>
  );
}

function RecurrenceField({ task, canEdit, mobile }: TaskDetailsProps) {
  if (task.recurrenceParentId) return <span className="text-sm text-fg-3">Instancja zadania cyklicznego</span>;
  return (
    <Popover>
      <PopoverTrigger disabled={!canEdit} aria-label="Cykliczność" className={cn("-mx-1 rounded-sm px-1 text-left text-sm outline-none hover:bg-n-100 disabled:hover:bg-transparent", mobile && "flex min-h-11 w-full items-center", !task.recurrenceRule && "text-fg-3")}>
        {summarizeRule(task.recurrenceRule)}
      </PopoverTrigger>
      <PopoverContent className="p-1">
        <div className="eyebrow px-2 pt-1 pb-1">Powtarzaj</div>
        <RecurrencePicker taskId={task.id} rule={task.recurrenceRule} disabled={!canEdit} />
      </PopoverContent>
    </Popover>
  );
}

function ViewsField({ views }: { views: { id: string; name: string }[] }) {
  if (views.length === 0) return <span className="text-sm text-fg-3">Brak</span>;
  return <div className="flex flex-wrap gap-1">{views.map((v) => <Chip key={v.id} hue="gray" size="sm">{v.name}</Chip>)}</div>;
}
