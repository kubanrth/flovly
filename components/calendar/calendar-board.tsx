"use client";

// Kalendarz tablicy (B7): Monday-first month grid, 20px task pills with a 3px
// status bar, „+N więcej" overflow, 280px day popover, pointer drag to
// reschedule. Mobile (<768px) → CalendarMobile (mini grid + day list).

import { startTransition, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconCopy, IconMore } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { CalendarMobile } from "./calendar-mobile";
import { QuickAddTask, StatusBar, pillSurface, statusHue } from "./calendar-parts";
import {
  WEEKDAYS,
  addMonths,
  countTasksInMonth,
  dayKey,
  dayKeyOf,
  dayTitle,
  dayTitleLong,
  monthGrid,
  monthLocative,
  monthTitle,
  parseDayKey,
  pillsByDay,
  shiftTaskDates,
  shortDate,
  splitDay,
  type CalendarMilestone,
  type CalendarTask,
  type TaskPill,
} from "./calendar-math";

export type { CalendarTask, CalendarMilestone } from "./calendar-math";

export interface CalendarMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CalendarStatus {
  id: string;
  name: string;
  colorHex: string | null;
}

const MAX_PILLS = 3;

export function CalendarBoard({
  workspaceId,
  boardId,
  canEdit,
  canCreate,
  tasks,
  milestones,
  statusColumns,
  members,
}: {
  workspaceId: string;
  boardId: string;
  canEdit: boolean;
  canCreate: boolean;
  tasks: CalendarTask[];
  milestones: CalendarMilestone[];
  statusColumns: CalendarStatus[];
  members: CalendarMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  useWorkspaceRealtime(workspaceId);
  const isMobile = useIsMobile();

  const [focus, setFocus] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  // Drag lands before the server answers — keep the pill where it was dropped.
  // Reset during render (not an effect) the moment fresh tasks arrive.
  const [optimistic, setOptimistic] = useState<{ base: CalendarTask[]; patch: Record<string, { startAt?: string; stopAt?: string }> }>({ base: tasks, patch: {} });
  if (optimistic.base !== tasks) setOptimistic({ base: tasks, patch: {} });

  const visible = useMemo(() => {
    const patch = optimistic.base === tasks ? optimistic.patch : {};
    const patched = tasks.map((t) => (patch[t.id] ? { ...t, ...patch[t.id] } : t));
    return patched.filter(
      (t) =>
        (statusFilter.length === 0 || (t.statusId !== null && statusFilter.includes(t.statusId))) &&
        (personFilter.length === 0 || t.assignees.some((a) => personFilter.includes(a.id))),
    );
  }, [tasks, optimistic, statusFilter, personFilter]);

  const byDay = useMemo(() => pillsByDay(visible), [visible]);
  const milestonesByDay = useMemo(() => {
    const map = new Map<string, CalendarMilestone[]>();
    for (const m of milestones) {
      const key = dayKeyOf(m.stopAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [milestones]);

  const days = useMemo(() => monthGrid(focus), [focus]);
  const todayKey = dayKey(new Date());
  const monthCount = countTasksInMonth(visible, focus);

  // ─── drag = move the whole task (pointer events, so touch + Playwright work) ─
  const dragRef = useRef<{ pill: TaskPill; x: number; y: number; moved: boolean; over: string | null } | null>(null);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState<{ key: string; over: string | null } | null>(null);

  const onPillPointerDown = (e: ReactPointerEvent<HTMLElement>, pill: TaskPill) => {
    if (!canEdit || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    swallowClick.current = false;
    dragRef.current = { pill, x: e.clientX, y: e.clientY, moved: false, over: null };
  };
  const onPillPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 4 && Math.abs(e.clientY - d.y) < 4) return;
    d.moved = true;
    d.over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day]")?.dataset.day ?? null;
    setDragging({ key: d.pill.key, over: d.over });
  };
  const onPillPointerCancel = () => {
    dragRef.current = null;
    setDragging(null);
  };
  const onPillClick = (e: { preventDefault: () => void }) => {
    if (!swallowClick.current) return;
    e.preventDefault();
    swallowClick.current = false;
  };
  const onPillPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(null);
    if (!d) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) return;
    swallowClick.current = true;
    if (d.over && d.over !== d.pill.day) moveTask(d.pill, d.over);
  };

  const moveTask = (pill: TaskPill, day: string) => {
    const patch = shiftTaskDates(pill.task, pill.kind, day);
    if (!patch) return;
    setOptimistic((o) => ({ base: o.base, patch: { ...o.patch, [pill.task.id]: patch } }));
    const fd = new FormData();
    fd.set("id", pill.task.id);
    if (patch.startAt) fd.set("startAt", patch.startAt);
    if (patch.stopAt) fd.set("stopAt", patch.stopAt);
    startTransition(async () => {
      try {
        await patchTaskAction(fd);
      } catch {
        // Odrzucone przez serwer (uprawnienia/konflikt) — cofnij podgląd.
        setOptimistic((o) => {
          const next = { ...o.patch };
          delete next[pill.task.id];
          return { base: o.base, patch: next };
        });
      }
      router.refresh();
    });
  };

  const goToday = () => {
    const now = new Date();
    setFocus(now);
    setSelected(dayKey(now));
  };

  if (isMobile) {
    return (
      <div data-ui="calendar-view" className="-mx-4 -my-4">
        <CalendarMobile
          workspaceId={workspaceId}
          boardId={boardId}
          canCreate={canCreate}
          focus={focus}
          onFocus={setFocus}
          selected={selected}
          onSelect={setSelected}
          byDay={byDay}
          onToday={goToday}
        />
      </div>
    );
  }

  return (
    <div data-ui="calendar-view" className="-mx-6 -my-4 flex min-h-0 flex-1 flex-col bg-card">
      {/* Toolbar — ‹ Miesiąc › Dzisiaj … Status Osoba ⋯ */}
      <div data-ui="calendar-toolbar" className="flex flex-none items-center gap-2 border-b border-border px-6 py-2">
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          aria-label="Poprzedni miesiąc"
          onClick={() => setFocus(addMonths(focus, -1))}
        >
          <IconChevronLeft width={13} height={13} strokeWidth={1.6} />
        </Button>
        <span className="min-w-[150px] text-center text-md font-semibold">{monthTitle(focus)}</span>
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          aria-label="Następny miesiąc"
          onClick={() => setFocus(addMonths(focus, 1))}
        >
          <IconChevronRight width={13} height={13} strokeWidth={1.6} />
        </Button>
        <Button variant="secondary" size="sm" onClick={goToday}>Dzisiaj</Button>
        <span className="flex-1" />
        <FilterMenu
          label="Status"
          active={statusFilter.length}
          items={statusColumns.map((s) => ({ id: s.id, label: <Chip hue={statusHue(s.colorHex)} dot size="md">{s.name}</Chip> }))}
          selected={statusFilter}
          onToggle={(id) => setStatusFilter((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))}
          onClear={() => setStatusFilter([])}
        />
        <FilterMenu
          label="Osoba"
          active={personFilter.length}
          items={members.map((m) => ({ id: m.id, label: <span className="flex items-center gap-2"><Avatar name={m.name} src={m.avatarUrl} size={20} />{m.name}</span> }))}
          selected={personFilter}
          onToggle={(id) => setPersonFilter((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))}
          onClear={() => setPersonFilter([])}
        />
        <Menu>
          <MenuTrigger
            aria-label="Więcej opcji"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            <IconMore width={16} height={16} />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              icon={<IconCopy />}
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.add({ title: "Skopiowano link do widoku" });
              }}
            >
              Kopiuj link do widoku
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {/* Grid — first row = Pon…Nd headers, then whole Mon-first weeks. */}
      <div
        data-ui="calendar-grid"
        className="grid min-h-0 flex-1 grid-cols-7 border-b border-border"
        // minmax(0,1fr): a 112px floor made a 6-week month overflow the viewport
        // and push the footer off screen. Cells scroll internally instead.
        style={{ gridTemplateRows: `32px repeat(${days.length / 7}, minmax(0, 1fr))` }}
      >
        {WEEKDAYS.map((name, i) => (
          <div
            key={name}
            className={cn(
              "eyebrow flex items-center border-b border-border px-2.5",
              i < 6 && "border-r border-table-grid",
              i >= 5 ? "bg-canvas text-fg-3" : "text-fg-2",
            )}
          >
            {name}
          </div>
        ))}

        {days.map((date, i) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === focus.getMonth();
          const weekend = i % 7 >= 5;
          const isToday = key === todayKey;
          const pills = byDay.get(key) ?? [];
          const dayMilestones = milestonesByDay.get(key) ?? [];
          const { visible: shown, overflow } = splitDay(pills, MAX_PILLS);
          const dropTarget = dragging?.over === key;

          return (
            <Popover key={key} open={openDay === key} onOpenChange={(o) => { setOpenDay(o ? key : null); if (o) setSelected(key); }}>
              <div
                data-ui="calendar-day"
                data-day={key}
                data-today={isToday || undefined}
                className={cn(
                  "relative flex flex-col gap-[3px] overflow-hidden px-1.5 py-1",
                  i % 7 !== 6 && "border-r border-table-grid",
                  i < days.length - 7 && "border-b border-table-grid",
                  weekend && "bg-canvas",
                  (isToday || selected === key || dropTarget) && "shadow-[inset_0_0_0_1px_var(--orange-500)]",
                  (selected === key || dropTarget) && "bg-selected",
                )}
              >
                <PopoverTrigger
                  aria-label={`Zadania na ${dayTitleLong(date)}`}
                  className="absolute inset-0 z-0 cursor-pointer outline-none hover:bg-row-hover active:bg-n-200 focus-visible:shadow-[var(--focus)]"
                />
                <span
                  className={cn(
                    "relative z-10 self-start text-xs leading-[18px]",
                    !inMonth && "text-n-400",
                    inMonth && weekend && "text-fg-3",
                    inMonth && !weekend && "font-medium",
                    isToday && "font-semibold text-orange-700",
                  )}
                >
                  {!inMonth && (i === 0 || date.getDate() === 1) ? shortDate(date) : date.getDate()}
                </span>

                {dayMilestones.map((m) => (
                  <Link
                    key={m.id}
                    href={`/w/${workspaceId}/b/${boardId}/roadmap`}
                    className="relative z-10 flex h-5 shrink-0 items-center gap-[5px] overflow-hidden rounded-sm bg-chip-orange-bg px-1.5 text-chip-orange-fg outline-none transition-opacity duration-[120ms] ease-[var(--ease-out)] hover:opacity-80 active:opacity-70 focus-visible:shadow-[var(--focus)]"
                    title={`Milestone: ${m.title}`}
                  >
                    <StatusBar hue="orange" />
                    <span className="truncate text-2xs font-semibold">◆ {m.title}</span>
                  </Link>
                ))}

                {shown.map((pill) => (
                  <CalendarPill
                    key={pill.key}
                    pill={pill}
                    workspaceId={workspaceId}
                    draggable={canEdit}
                    dragging={dragging?.key === pill.key}
                    onPointerDown={onPillPointerDown}
                    onPointerMove={onPillPointerMove}
                    onPointerUp={onPillPointerUp}
                    onPointerCancel={onPillPointerCancel}
                    onClick={onPillClick}
                  />
                ))}

                {overflow > 0 && (
                  <span className="pointer-events-none relative z-10 text-2xs font-medium text-orange-700">
                    +{overflow} więcej
                  </span>
                )}
              </div>

              <PopoverContent data-ui="calendar-day-popover" align="start" className="w-[280px] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <PopoverTitle>{dayTitle(date)}</PopoverTitle>
                  <span className="ml-auto font-mono text-[10px] text-fg-3">
                    {pills.length} {taskPl(pills.length)}
                  </span>
                </div>
                {pills.length === 0 && <p className="py-1 text-xs text-muted-foreground">Brak zadań tego dnia.</p>}
                {pills.map((pill) => (
                  <Link
                    key={pill.key}
                    href={`/w/${workspaceId}/t/${pill.task.id}`}
                    className="-mx-1 flex h-[26px] items-center gap-1.5 rounded-sm px-1 outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
                  >
                    <StatusBar hue={statusHue(pill.task.statusColor)} tall />
                    <span className="font-mono text-[10px] text-fg-3">#{pill.task.displayId}</span>
                    <span className="flex-1 truncate text-xs text-foreground">{pill.label}</span>
                    {pill.task.assignees[0] && (
                      <Avatar name={pill.task.assignees[0].name} src={pill.task.assignees[0].avatarUrl} size={20} />
                    )}
                  </Link>
                ))}
                {canCreate && (
                  <div className="mt-1.5 border-t border-n-100 pt-2">
                    <QuickAddTask workspaceId={workspaceId} boardId={boardId} day={key} onDone={() => setOpenDay(null)} />
                  </div>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <div className="flex h-8 flex-none items-center border-t border-border bg-canvas px-6">
        <span className="font-mono text-2xs text-fg-2">
          {monthCount} {taskPl(monthCount)} {monthLocative(focus)} · pasek koloru = status
        </span>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-fg-3">
          zaznaczony dzień: {shortDate(parseDayKey(selected))} · ◆ = milestone
        </span>
      </div>
    </div>
  );
}

function CalendarPill({
  pill,
  workspaceId,
  draggable,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}: {
  pill: TaskPill;
  workspaceId: string;
  draggable: boolean;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, pill: TaskPill) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onClick: (e: { preventDefault: () => void }) => void;
}) {
  const hue = statusHue(pill.task.statusColor);
  return (
    <Link
      href={`/w/${workspaceId}/t/${pill.task.id}`}
      data-ui="calendar-pill"
      data-task-id={pill.task.id}
      draggable={false}
      title={`#${pill.task.displayId} ${pill.label}${pill.task.statusName ? ` · ${pill.task.statusName}` : ""}${draggable ? " · przeciągnij, aby przenieść" : ""}`}
      onPointerDown={draggable ? (e) => onPointerDown(e, pill) : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? onPointerUp : undefined}
      onPointerCancel={draggable ? onPointerCancel : undefined}
      onClick={onClick}
      className={cn(
        "relative z-10 flex h-5 shrink-0 items-center gap-[5px] overflow-hidden rounded-sm px-1.5 outline-none transition-opacity duration-[120ms] ease-[var(--ease-out)] hover:opacity-80 active:opacity-70 focus-visible:shadow-[var(--focus)]",
        pillSurface(hue),
        draggable && "cursor-grab",
        dragging && "cursor-grabbing opacity-50",
      )}
    >
      <StatusBar hue={hue} />
      <span className="truncate text-2xs font-medium">{pill.label}</span>
    </Link>
  );
}

function FilterMenu({
  label,
  active,
  items,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  active: number;
  items: { id: string; label: ReactNode }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]",
          active > 0 ? "bg-selected text-orange-800" : "text-n-700",
        )}
      >
        {label}
        {active > 0 && ` · ${active}`}
        <IconChevronDown width={11} height={11} strokeWidth={1.8} />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{label}</MenuLabel>
        {items.length === 0 && <MenuItem disabled>Brak opcji</MenuItem>}
        {items.map((item) => (
          <MenuCheckboxItem key={item.id} checked={selected.includes(item.id)} closeOnClick={false} onCheckedChange={() => onToggle(item.id)}>
            {item.label}
          </MenuCheckboxItem>
        ))}
        {active > 0 && <MenuItem onClick={onClear}>Wyczyść</MenuItem>}
      </MenuContent>
    </Menu>
  );
}
