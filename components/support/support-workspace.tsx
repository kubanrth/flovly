"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Paperclip,
  Pause,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import {
  confirmSupportAttachmentUploadAction,
  createSupportTicketAction,
  deleteSupportAttachmentAction,
  deleteSupportTicketAction,
  requestSupportAttachmentUploadAction,
  updateSupportTicketAction,
} from "@/app/(app)/w/[workspaceId]/support/actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { formatDuration } from "@/lib/format-duration";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface SupportMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface SupportAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploaderId: string;
}

export interface SupportTicketRow {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueAt: string | null;
  isUrgent: boolean;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignee: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  attachments: SupportAttachment[];
}

const STATUS_META: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Nowe", color: "#3B82F6", icon: AlertCircle },
  IN_PROGRESS: { label: "W toku", color: "#F59E0B", icon: Clock },
  RESOLVED: { label: "Rozwiązane", color: "#10B981", icon: CheckCircle2 },
  CLOSED: { label: "Zamknięte", color: "#64748B", icon: Pause },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  LOW: { label: "Niski", color: "#94A3B8" },
  MEDIUM: { label: "Średni", color: "#3B82F6" },
  HIGH: { label: "Wysoki", color: "#F59E0B" },
  URGENT: { label: "Pilny", color: "#EF4444" },
};

const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function isClosed(s: Status): boolean {
  return s === "RESOLVED" || s === "CLOSED";
}

export function SupportWorkspace({
  workspaceId,
  currentUserId,
  canManage,
  tickets,
  members,
}: {
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  tickets: SupportTicketRow[];
  members: SupportMember[];
}) {
  // Store id (not full ticket) — re-lookup on every render so revalidated data stays fresh in dialog.
  const [editingId, setEditingId] = useState<string | null>(null);

  const STORAGE_KEY = "support-table-col-widths.v1";
  const DEFAULT_WIDTHS: Record<string, number> = {
    title: 320,
    status: 140,
    priority: 120,
    due: 170,
    reporter: 150,
    assignee: 170,
    resolvedIn: 170,
    actions: 90,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        setColWidths({ ...DEFAULT_WIDTHS, ...parsed });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setColWidth = (key: string, width: number) => {
    setColWidths((prev) => {
      const next = { ...prev, [key]: Math.max(60, Math.round(width)) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const editing = editingId
    ? tickets.find((t) => t.id === editingId) ?? null
    : null;

  const statusCounts: Record<Status, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
  for (const t of tickets) statusCounts[t.status] += 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">Wsparcie</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          <span className="text-brand-gradient">Support</span> — zgłoszenia.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Zgłoś temat wymagający supportu. Admini przestrzeni przypisują
          osobę odpowiedzialną i zamykają zgłoszenia.
        </p>
        {tickets.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="text-foreground font-semibold">{tickets.length}</span>
              łącznie
            </span>
            {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as Status[]).map((s) => {
              if (statusCounts[s] === 0) return null;
              const m = STATUS_META[s];
              const Icon = m.icon;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] font-semibold"
                  style={{ background: `${m.color}1A`, color: m.color }}
                >
                  <Icon size={11} />
                  {statusCounts[s]} {m.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <NewTicketForm workspaceId={workspaceId} />

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="font-display text-[1rem] font-semibold">Brak zgłoszeń.</p>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Wciśnij „Nowe zgłoszenie", żeby dodać pierwszy ticket.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(46,19,52,0.08)]">
          <div className="overflow-x-auto">
            <table className="text-[0.88rem]" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <Th colKey="title" width={colWidths.title} onResize={setColWidth}>Tytuł</Th>
                  <Th colKey="status" width={colWidths.status} onResize={setColWidth}>Status</Th>
                  <Th colKey="priority" width={colWidths.priority} onResize={setColWidth}>Priorytet</Th>
                  <Th colKey="due" width={colWidths.due} onResize={setColWidth}>Termin</Th>
                  <Th colKey="reporter" width={colWidths.reporter} onResize={setColWidth}>Zgłaszający</Th>
                  <Th colKey="assignee" width={colWidths.assignee} onResize={setColWidth}>Odpowiedzialny</Th>
                  <Th colKey="resolvedIn" width={colWidths.resolvedIn} onResize={setColWidth}>Zamknięte w</Th>
                  <Th colKey="actions" width={colWidths.actions} onResize={setColWidth} align="right">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    members={members}
                    canManage={canManage}
                    currentUserId={currentUserId}
                    onEdit={() => setEditingId(t.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditTicketDialog
          ticket={editing}
          canManage={canManage}
          currentUserId={currentUserId}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function Th({
  children,
  colKey,
  width,
  align,
  onResize,
}: {
  children: React.ReactNode;
  colKey: string;
  width: number;
  align?: "left" | "right";
  onResize: (key: string, width: number) => void;
}) {
  const startX = useRef(0);
  const startW = useRef(0);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      onResize(colKey, startW.current + delta);
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, colKey, onResize]);

  return (
    <th
      className={`relative h-10 select-none px-4 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {children}
      <span
        role="separator"
        aria-label={`Zmień szerokość ${colKey}`}
        onMouseDown={(e) => {
          e.preventDefault();
          startX.current = e.clientX;
          startW.current = width;
          setResizing(true);
        }}
        className={`absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/40 ${
          resizing ? "bg-primary" : ""
        }`}
      />
    </th>
  );
}

function TicketRow({
  ticket,
  members,
  canManage,
  currentUserId,
  onEdit,
}: {
  ticket: SupportTicketRow;
  members: SupportMember[];
  canManage: boolean;
  currentUserId: string;
  onEdit: () => void;
}) {
  const StatusIcon = STATUS_META[ticket.status].icon;
  const statusColor = STATUS_META[ticket.status].color;
  const priorityColor = PRIORITY_META[ticket.priority].color;
  const isReporter = ticket.reporter.id === currentUserId;
  // Reporter can edit while OPEN and unassigned; admin (canManage) always.
  const canEditContent =
    canManage || (isReporter && ticket.status === "OPEN" && !ticket.assignee);

  const ticketClosed = isClosed(ticket.status);
  const closedDuration =
    ticketClosed && ticket.resolvedAt
      ? formatDuration(ticket.createdAt, ticket.resolvedAt)
      : null;

  return (
    <tr className="border-b border-border last:border-b-0 align-middle hover:bg-accent/30">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onEdit}
          className="block w-full text-left font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] hover:text-primary"
        >
          {ticket.title}
        </button>
        <div className="mt-0.5 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
          {ticket.description && (
            <p className="line-clamp-1 min-w-0 flex-1">{ticket.description}</p>
          )}
          {ticket.attachments.length > 0 && (
            <AttachmentBadge attachments={ticket.attachments} />
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        {canManage ? (
          <StatusSelect
            ticketId={ticket.id}
            current={ticket.status}
          />
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
            style={{ background: `${statusColor}1A`, color: statusColor }}
          >
            <StatusIcon size={11} />
            {STATUS_META[ticket.status].label}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {canManage ? (
          <PrioritySelect ticketId={ticket.id} current={ticket.priority} />
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
            style={{ background: `${priorityColor}1A`, color: priorityColor }}
          >
            {PRIORITY_META[ticket.priority].label}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <DueCell ticket={ticket} canEdit={canEditContent} />
      </td>

      <td className="px-4 py-3">
        <PersonChip person={ticket.reporter} />
      </td>

      <td className="px-4 py-3">
        {canManage ? (
          <AssigneeSelect ticketId={ticket.id} current={ticket.assignee} members={members} />
        ) : ticket.assignee ? (
          <PersonChip person={ticket.assignee} />
        ) : (
          <MutedDash />
        )}
      </td>

      <td className="px-4 py-3">
        {closedDuration ? (
          <span className="font-mono text-[0.78rem] text-muted-foreground">
            {closedDuration}
          </span>
        ) : (
          <MutedDash />
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {canEditContent && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edytuj zgłoszenie"
              title="Edytuj"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
          )}
          {canManage && (
            <DeleteButton ticketId={ticket.id} title={ticket.title} />
          )}
        </div>
      </td>
    </tr>
  );
}

function MutedDash() {
  return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
}

function PersonChip({
  person,
}: {
  person: { name: string | null; email: string; avatarUrl: string | null };
}) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (person.name ?? person.email).slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="min-w-0 truncate text-[0.84rem]">
        {person.name ?? person.email.split("@")[0]}
      </span>
    </span>
  );
}

// Portal-to-body to avoid clipping by table overflow + sticky cells.
function useDropdown() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "below" | "above";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
  };

  const compute = (preferredWidth = 220) => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return null;
    if (r.bottom < 0 || r.top > window.innerHeight) return null;
    const margin = 8;
    const desiredHeight = 320;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const placement: "below" | "above" =
      spaceBelow >= 200 || spaceBelow >= spaceAbove ? "below" : "above";
    const width = Math.max(r.width, preferredWidth);
    const left = Math.min(
      Math.max(r.left, margin),
      window.innerWidth - width - margin,
    );
    if (placement === "below") {
      return { top: r.bottom + 4, left, width, placement };
    }
    return {
      top: Math.max(margin, r.top - 4 - desiredHeight),
      left,
      width,
      placement,
    };
  };

  const openPicker = (preferredWidth?: number) => {
    const c = compute(preferredWidth);
    if (!c) return;
    setCoords(c);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => {
      const c = compute();
      if (c) setCoords(c);
      else close();
    };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { open, coords, triggerRef, popRef, openPicker, close };
}

function StatusSelect({ ticketId, current }: { ticketId: string; current: Status }) {
  const meta = STATUS_META[current];
  const Icon = meta.icon;
  const dd = useDropdown();

  const pick = (s: Status) => {
    const fd = new FormData();
    fd.set("id", ticketId);
    fd.set("status", s);
    startTransition(() => updateSupportTicketAction(fd));
    dd.close();
  };

  return (
    <>
      <button
        ref={dd.triggerRef}
        type="button"
        onClick={() => (dd.open ? dd.close() : dd.openPicker(220))}
        aria-haspopup="listbox"
        aria-expanded={dd.open}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-opacity hover:opacity-80"
        style={{ background: `${meta.color}1A`, color: meta.color }}
      >
        <Icon size={11} />
        <span>{meta.label}</span>
        <ChevronDown size={11} className="opacity-70" />
      </button>
      {dd.open && dd.coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dd.popRef}
            style={{
              position: "fixed",
              top: dd.coords.top,
              left: dd.coords.left,
              width: dd.coords.width,
            }}
            className="z-[80] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <ul role="listbox" className="flex flex-col gap-0.5">
              {STATUSES.map((s) => {
                const m = STATUS_META[s];
                const SI = m.icon;
                const active = s === current;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(s)}
                      data-active={active}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.84rem] transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                        style={{ background: `${m.color}1A`, color: m.color }}
                      >
                        <SI size={12} />
                      </span>
                      <span className="flex-1">{m.label}</span>
                      {active && (
                        <span className="font-mono text-[0.62rem] text-primary">✓</span>
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

function PrioritySelect({ ticketId, current }: { ticketId: string; current: Priority }) {
  const meta = PRIORITY_META[current];
  const dd = useDropdown();

  const pick = (p: Priority) => {
    const fd = new FormData();
    fd.set("id", ticketId);
    fd.set("priority", p);
    startTransition(() => updateSupportTicketAction(fd));
    dd.close();
  };

  return (
    <>
      <button
        ref={dd.triggerRef}
        type="button"
        onClick={() => (dd.open ? dd.close() : dd.openPicker(180))}
        aria-haspopup="listbox"
        aria-expanded={dd.open}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-opacity hover:opacity-80"
        style={{ background: `${meta.color}1A`, color: meta.color }}
      >
        <span>{meta.label}</span>
        <ChevronDown size={11} className="opacity-70" />
      </button>
      {dd.open && dd.coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dd.popRef}
            style={{
              position: "fixed",
              top: dd.coords.top,
              left: dd.coords.left,
              width: dd.coords.width,
            }}
            className="z-[80] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <ul role="listbox" className="flex flex-col gap-0.5">
              {PRIORITIES.map((p) => {
                const m = PRIORITY_META[p];
                const active = p === current;
                return (
                  <li key={p}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(p)}
                      data-active={active}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.84rem] transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: m.color }}
                      />
                      <span className="flex-1">{m.label}</span>
                      {active && (
                        <span className="font-mono text-[0.62rem] text-primary">✓</span>
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

function AssigneeSelect({
  ticketId,
  current,
  members,
}: {
  ticketId: string;
  current: SupportTicketRow["assignee"];
  members: SupportMember[];
}) {
  const dd = useDropdown();
  const [query, setQuery] = useState("");

  const pick = (userId: string) => {
    const fd = new FormData();
    fd.set("id", ticketId);
    fd.set("assigneeId", userId);
    startTransition(() => updateSupportTicketAction(fd));
    dd.close();
    setQuery("");
  };

  const q = query.trim().toLowerCase();
  const filtered = members.filter((m) => {
    if (!q) return true;
    const n = (m.name ?? "").toLowerCase();
    return n.includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <>
      <button
        ref={dd.triggerRef}
        type="button"
        onClick={() => (dd.open ? dd.close() : dd.openPicker(280))}
        aria-haspopup="listbox"
        aria-expanded={dd.open}
        className="inline-flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left transition-colors hover:border-border hover:bg-accent/40"
      >
        {current ? (
          <PersonChip person={current} />
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">
            <UserPlus size={11} /> przypisz
          </span>
        )}
        <ChevronDown size={11} className="ml-auto shrink-0 text-muted-foreground" />
      </button>
      {dd.open && dd.coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dd.popRef}
            style={{
              position: "fixed",
              top: dd.coords.top,
              left: dd.coords.left,
              width: dd.coords.width,
            }}
            className="z-[80] flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj osoby…"
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-[0.82rem] outline-none focus:border-primary/60"
              />
            </div>
            <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!current}
                  onClick={() => pick("")}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.82rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <X size={11} />
                  </span>
                  <span className="flex-1">— brak —</span>
                  {!current && (
                    <span className="font-mono text-[0.62rem] text-primary">✓</span>
                  )}
                </button>
              </li>
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                  brak dopasowań
                </li>
              )}
              {filtered.map((m) => {
                const active = m.id === current?.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(m.id)}
                      data-active={active}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.84rem] transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (m.name ?? m.email).slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate font-medium">
                          {m.name ?? m.email}
                        </span>
                        {m.name && (
                          <span className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                            {m.email}
                          </span>
                        )}
                      </div>
                      {active && (
                        <span className="font-mono text-[0.62rem] text-primary">✓</span>
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

function DueCell({ ticket, canEdit }: { ticket: SupportTicketRow; canEdit: boolean }) {
  // Three states: NATYCHMIAST badge / formatted date / empty. isUrgent excludes dueAt.
  if (ticket.isUrgent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-destructive">
        <Zap size={11} /> NATYCHMIAST
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              const fd = new FormData();
              fd.set("id", ticket.id);
              fd.set("isUrgent", "false");
              startTransition(() => updateSupportTicketAction(fd));
            }}
            aria-label="Wyłącz NATYCHMIAST"
            title="Wyłącz NATYCHMIAST"
            className="ml-1 grid h-4 w-4 place-items-center rounded text-destructive/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            ×
          </button>
        )}
      </span>
    );
  }

  if (!canEdit) {
    return ticket.dueAt ? (
      <span className="font-mono text-[0.78rem]">
        {new Date(ticket.dueAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ) : (
      <MutedDash />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <DateTimePicker
        name="dueAt"
        defaultValue={ticket.dueAt}
        variant="cell"
        placeholder="Brak terminu"
        onChange={(iso) => {
          const fd = new FormData();
          fd.set("id", ticket.id);
          fd.set("dueAt", iso);
          startTransition(() => updateSupportTicketAction(fd));
        }}
      />
      <button
        type="button"
        onClick={() => {
          const fd = new FormData();
          fd.set("id", ticket.id);
          fd.set("isUrgent", "true");
          startTransition(() => updateSupportTicketAction(fd));
        }}
        aria-label="Oznacz jako NATYCHMIAST"
        title="NATYCHMIAST"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Zap size={12} />
      </button>
    </div>
  );
}

function DeleteButton({ ticketId, title }: { ticketId: string; title: string }) {
  return (
    <form
      action={(fd) => {
        if (!confirm(`Usunąć zgłoszenie „${title}"? Tego nie da się cofnąć.`)) return;
        startTransition(() => deleteSupportTicketAction(fd));
      }}
      className="m-0 inline"
    >
      <input type="hidden" name="id" value={ticketId} />
      <button
        type="submit"
        aria-label="Usuń zgłoszenie"
        title="Usuń"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={12} />
      </button>
    </form>
  );
}

function EditTicketDialog({
  ticket,
  canManage,
  currentUserId,
  onClose,
}: {
  ticket: SupportTicketRow;
  canManage: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const isReporter = ticket.reporter.id === currentUserId;
  const canEditContent =
    canManage || (isReporter && ticket.status === "OPEN" && !ticket.assignee);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);

  const submit = () => {
    if (!canEditContent) {
      onClose();
      return;
    }
    const fd = new FormData();
    fd.set("id", ticket.id);
    if (title.trim() !== ticket.title) fd.set("title", title.trim());
    if (description.trim() !== ticket.description) fd.set("description", description.trim());
    startTransition(async () => {
      await updateSupportTicketAction(fd);
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] flex-col gap-4 rounded-xl border border-border bg-popover p-6 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="eyebrow">Zgłoszenie</span>
            <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              utworzone {new Date(ticket.createdAt).toLocaleString("pl-PL")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="eyebrow">Tytuł</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEditContent}
            maxLength={200}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.95rem] outline-none focus:border-primary disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="eyebrow">Opis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEditContent}
            rows={6}
            maxLength={5000}
            className="min-h-[140px] resize-y rounded-md border border-border bg-background p-3 text-[0.9rem] outline-none focus:border-primary disabled:opacity-60"
          />
        </div>

        {!canEditContent && (
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/80">
            Edycja zablokowana — zgłoszenie zostało przypisane lub zamknięte.
            Tylko admin może je dalej zmieniać.
          </p>
        )}

        <AttachmentsSection
          ticketId={ticket.id}
          attachments={ticket.attachments}
          currentUserId={currentUserId}
          canManage={canManage}
        />

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {canEditContent ? "Anuluj" : "Zamknij"}
          </button>
          {canEditContent && (
            <button
              type="button"
              onClick={submit}
              disabled={!title.trim() || !description.trim()}
              className="inline-flex h-9 items-center justify-center rounded-md bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
            >
              Zapisz zmiany
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTicketForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [isUrgent, setIsUrgent] = useState(false);
  const [dueAt, setDueAt] = useState<string>("");
  // Uploaded after ticket creation — need ticketId to save.
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOpen(false);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setIsUrgent(false);
    setDueAt("");
    setFiles([]);
    setError(null);
  };

  const inferContentType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
      md: "text/markdown",
    };
    return ext && map[ext] ? map[ext] : "application/octet-stream";
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("priority", priority);
      fd.set("isUrgent", isUrgent ? "true" : "false");
      fd.set("dueAt", isUrgent ? "" : dueAt);
      const res = await createSupportTicketAction(fd);
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      // Parallel upload; per-file failures don't block — partial success is acceptable since ticket exists.
      if (files.length > 0) {
        await Promise.all(
          files.map(async (f) => {
            const ct = inferContentType(f);
            const reqRes = await requestSupportAttachmentUploadAction(
              res.ticketId,
              f.name,
              ct,
              f.size,
            );
            if (!reqRes.ok) return;
            try {
              const putRes = await fetch(reqRes.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": ct },
                body: f,
              });
              if (!putRes.ok) return;
              await confirmSupportAttachmentUploadAction({
                ticketId: res.ticketId,
                storageKey: reqRes.storageKey,
                filename: f.name,
                contentType: ct,
                sizeBytes: f.size,
              });
            } catch {
              /* swallow per-file errors */
            }
          }),
        );
      }
      router.refresh();
      reset();
    } catch (e) {
      console.warn("[create-ticket] error", e);
      setError("Nie udało się utworzyć zgłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
      >
        <Plus size={14} /> Nowe zgłoszenie
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
    >
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Temat</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          maxLength={200}
          placeholder="Krótko o co chodzi"
          className="h-10 border-b border-border bg-transparent pb-1 font-display text-[1.1rem] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Opis</span>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          maxLength={5000}
          placeholder="Co się dzieje, jakich kroków oczekujesz, co już próbowałeś…"
          className="min-h-[100px] resize-y rounded-md border border-border bg-background p-2 text-[0.9rem] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Priorytet:</span>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`h-7 rounded-full border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] transition-colors ${
              priority === p
                ? "border-transparent text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            style={priority === p ? { background: PRIORITY_META[p].color } : undefined}
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Kiedy potrzebujesz tego rozwiązanego?</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsUrgent((v) => !v)}
            data-active={isUrgent}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive data-[active=true]:border-destructive data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive"
          >
            <Zap size={12} /> NATYCHMIAST
          </button>
          {!isUrgent && (
            <div className="min-w-[260px] flex-1">
              <DateTimePicker
                name="__dueAtPicker"
                defaultValue={dueAt || null}
                placeholder="Brak konkretnej daty"
                onChange={(iso) => setDueAt(iso)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Załączniki (screenshoty, pliki)</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Upload size={12} /> Dodaj plik
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (list.length > 0) setFiles((prev) => [...prev, ...list]);
            }}
          />
          {files.length === 0 && (
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
              opcjonalne
            </span>
          )}
        </div>
        {files.length > 0 && (
          <ul className="flex flex-col gap-1">
            {files.map((f, idx) => (
              <li
                key={`${f.name}-${idx}`}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5"
              >
                <Paperclip size={12} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[0.84rem]">
                  {f.name}
                </span>
                <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {formatFileSize(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Usuń z listy"
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !description.trim()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
        >
          {submitting ? "Wysyłam…" : "Zgłoś"}
        </button>
      </div>
    </form>
  );
}

// Links open via /api/support-attachment/[...path] route which verifies access and 302s to a signed URL.
function AttachmentsSection({
  ticketId,
  attachments,
  currentUserId,
  canManage,
}: {
  ticketId: string;
  attachments: SupportAttachment[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server rejects files without detected MIME (e.g. .heic) — map common extensions client-side first.
  const inferContentType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
      md: "text/markdown",
    };
    return ext && map[ext] ? map[ext] : "application/octet-stream";
  };

  const onPick = async (file: File) => {
    setError(null);
    setUploading(true);
    const contentType = inferContentType(file);
    try {
      const req = await requestSupportAttachmentUploadAction(
        ticketId,
        file.name,
        contentType,
        file.size,
      );
      if (!req.ok) {
        setError(req.error);
        setUploading(false);
        return;
      }
      const putRes = await fetch(req.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) {
        const body = await putRes.text().catch(() => "");
        console.warn("[support-attachment] PUT failed", putRes.status, body);
        setError(`Upload nie powiódł się (HTTP ${putRes.status}).`);
        setUploading(false);
        return;
      }
      const confirmRes = await confirmSupportAttachmentUploadAction({
        ticketId,
        storageKey: req.storageKey,
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      });
      if (!confirmRes.ok) {
        setError(confirmRes.error ?? "Nie udało się zapisać pliku.");
        setUploading(false);
        return;
      }
      // Explicit refresh — revalidatePath doesn't always reach the open dialog (intercepted route cache).
      router.refresh();
    } catch (e) {
      console.warn("[support-attachment] upload error", e);
      setError("Upload nie powiódł się — sprawdź połączenie.");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    if (!confirm("Usunąć ten załącznik?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteSupportAttachmentAction(fd);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Załączniki</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-60"
        >
          <Upload size={11} /> {uploading ? "Wysyłam…" : "Dodaj plik"}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onPick(f);
          }}
        />
      </div>
      {error && (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}
      {attachments.length === 0 ? (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          Brak załączników. Dodaj screenshot lub plik aby ułatwić obsługę zgłoszenia.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => {
            const canDelete = a.uploaderId === currentUserId || canManage;
            const isImage = a.mimeType.startsWith("image/");
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden
                >
                  {isImage ? (
                    <span className="text-[0.62rem] font-mono">IMG</span>
                  ) : (
                    <Paperclip size={14} />
                  )}
                </span>
                <a
                  href={`/api/support-attachment/${a.storageKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 flex-col leading-tight hover:text-primary"
                >
                  <span className="truncate text-[0.86rem] font-medium">
                    {a.filename}
                  </span>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatFileSize(a.sizeBytes)} · klik aby otworzyć
                  </span>
                </a>
                <a
                  href={`/api/support-attachment/${a.storageKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Otwórz w nowej karcie"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink size={12} />
                </a>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Usuń załącznik"
                    title="Usuń"
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentBadge({ attachments }: { attachments: SupportAttachment[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setCoords(null);
  };

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      close();
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const width = 320;
    const left = Math.min(
      Math.max(r.left, margin),
      window.innerWidth - width - margin,
    );
    setCoords({ top: r.bottom + 4, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        title={`${attachments.length} załączników — klik aby otworzyć`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Paperclip size={11} />
        {attachments.length}
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: 320 }}
            className="z-[80] flex flex-col overflow-hidden rounded-lg border border-border bg-popover p-2 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
              Załączniki
            </div>
            <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {attachments.map((a) => {
                const isImage = a.mimeType.startsWith("image/");
                return (
                  <li key={a.id}>
                    <a
                      href={`/api/support-attachment/${a.storageKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        {isImage ? (
                          <span className="text-[0.62rem] font-mono">IMG</span>
                        ) : (
                          <Paperclip size={13} />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[0.84rem] group-hover:text-primary">
                          {a.filename}
                        </span>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                          {formatFileSize(a.sizeBytes)}
                        </span>
                      </div>
                      <ExternalLink
                        size={12}
                        className="shrink-0 text-muted-foreground/60 group-hover:text-foreground"
                      />
                    </a>
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
