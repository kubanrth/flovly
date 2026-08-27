"use client";

// E9 „Support" — skrzynka zgłoszeń: kolejki + lista 400 px + wątek.
// Makieta trzyma kolejki w globalnym pasku bocznym; tutaj są w kolumnie
// strony, bo shell nie ma kontekstowych sekcji (ten sam kompromis co
// „Widoczne w kalendarzu" w D4 — patrz docs/redesign/OMITTED.md).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { IconPlus, IconSupport } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { NewTicketDialog } from "./new-ticket-dialog";
import { TicketDetail, type SupportBoard } from "./ticket-detail";
import {
  PRIORITY_META,
  QUEUES,
  inQueue,
  personLabel,
  queueCounts,
  ticketCode,
  type QueueId,
  type SupportMember,
  type SupportTicketRow,
} from "./support-model";

export type { SupportBoard };

export function SupportWorkspace({
  workspaceId,
  currentUserId,
  canManage,
  canCreateTask,
  tickets,
  members,
  boards,
  /** Znacznik „teraz" z serwera — okno 30 dni kolejki „Rozwiązane". */
  nowMs,
}: {
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  canCreateTask: boolean;
  tickets: SupportTicketRow[];
  members: SupportMember[];
  boards: SupportBoard[];
  nowMs: number;
}) {
  const counts = queueCounts(tickets, nowMs);
  const firstNonEmpty = QUEUES.find((q) => counts[q.id] > 0)?.id ?? "open";
  const [queue, setQueue] = useState<QueueId>(firstNonEmpty);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const list = tickets.filter((t) => inQueue(t, queue, nowMs));
  // `selected` = jawny wybór użytkownika (steruje mobilnym przełączeniem
  // lista ⇄ wątek); `shown` dokłada domyślny pierwszy ticket, żeby desktop
  // nigdy nie stał pusty — jak w makiecie, gdzie SUP-118 jest otwarte.
  const selected = list.find((t) => t.id === selectedId) ?? null;
  const shown = selected ?? list[0] ?? null;
  const queueLabel = QUEUES.find((q) => q.id === queue)!.label;

  const pickQueue = (id: QueueId) => {
    setQueue(id);
    setSelectedId(null);
  };

  return (
    <div data-ui="support" className="flex min-h-0 min-w-0 flex-1">
      <aside
        data-ui="support-queues"
        className="flex w-[240px] shrink-0 flex-col border-r border-border bg-canvas p-2 max-lg:hidden"
      >
        <p className="eyebrow flex h-[30px] items-end px-2">Kolejki</p>
        {QUEUES.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-current={q.id === queue ? "true" : undefined}
            onClick={() => pickQueue(q.id)}
            className={cn(
              "flex h-[30px] items-center gap-2 rounded-md px-2 text-left outline-none",
              q.id === queue
                ? "bg-n-100 font-medium text-foreground"
                : "text-n-700 hover:bg-n-100 active:bg-n-200",
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-[2px]", QUEUE_DOT[q.id])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs">{q.label}</span>
            <span className="shrink-0 font-mono text-2xs text-fg-3">{counts[q.id]}</span>
          </button>
        ))}
      </aside>

      <div
        data-ui="support-list"
        className={cn(
          "flex w-[400px] shrink-0 flex-col border-r border-border max-md:w-full",
          selected && "max-md:hidden",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5 pb-2.5">
          <span className="min-w-0 flex-1 truncate text-md font-semibold">
            {queueLabel} · {counts[queue]}
          </span>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <IconPlus width={12} height={12} />
            Nowe zgłoszenie
          </Button>
        </div>

        <div className="shrink-0 px-3.5 pb-2 lg:hidden">
          <Segmented
            aria-label="Kolejka"
            value={queue}
            onChange={(v) => pickQueue(v as QueueId)}
            options={QUEUES.map((q) => ({ value: q.id, label: `${q.label} (${counts[q.id]})` }))}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {list.length === 0 ? (
            <div className="p-2">
              <EmptyState
                icon={<IconSupport />}
                title="Pusto w tej kolejce"
                description="Nowe zgłoszenia trafiają tu od razu po wysłaniu."
              />
            </div>
          ) : (
            list.map((t) => {
              const active = shown?.id === t.id;
              const prio = PRIORITY_META[t.priority];
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "mb-0.5 flex w-full flex-col gap-[3px] rounded-md p-2.5 text-left outline-none",
                    active
                      ? "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]"
                      : "hover:bg-row-hover active:bg-n-200",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-2xs text-fg-3">{ticketCode(t.id)}</span>
                    <Chip hue={prio.hue} size="sm">
                      {prio.label}
                    </Chip>
                    {t.isUrgent && (
                      <Chip hue="red" size="sm">
                        NATYCHMIAST
                      </Chip>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-2xs text-fg-3">{t.listTime}</span>
                  </span>
                  <span
                    className={cn(
                      "line-clamp-1 text-sm leading-[18px]",
                      active ? "font-semibold" : "font-medium",
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="line-clamp-1 text-xs leading-[17px] text-fg-2">
                    Zgłasza: {personLabel(t.reporter)}
                    {t.assignee ? ` · obsługuje ${personLabel(t.assignee)}` : " · bez przypisania"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {shown ? (
        <div className={cn("flex min-w-0 flex-1", !selected && "max-md:hidden")}>
          <TicketDetail
            key={shown.id}
            ticket={shown}
            members={members}
            boards={boards}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            canManage={canManage}
            canCreateTask={canCreateTask}
            onBack={() => setSelectedId(null)}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center p-8 max-md:hidden">
          <EmptyState
            icon={<IconSupport />}
            title="Wybierz zgłoszenie"
            description="Kliknij pozycję z listy, żeby zobaczyć treść, kontekst i akcje."
          />
        </div>
      )}

      <NewTicketDialog
        workspaceId={workspaceId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          setQueue("open");
          setSelectedId(id);
        }}
      />
    </div>
  );
}

const QUEUE_DOT: Record<QueueId, string> = {
  open: "bg-danger",
  in_progress: "bg-info",
  resolved: "bg-success",
};
