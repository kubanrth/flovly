"use client";

import { startTransition, useState } from "react";
import {
  createReminderAction,
  deleteOldRemindersAction,
  deleteReminderAction,
  dismissReminderAction,
  hideOldReceivedRemindersAction,
  hideReceivedReminderAction,
  updateReminderAction,
} from "@/app/(app)/my/reminders/actions";
import { Button } from "@/components/ui/button";
import {
  IconBell,
  IconEyeOff,
  IconPen,
  IconPlus,
  IconRecent,
  IconTrash,
  IconUser,
} from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SELECT =
  "h-8 rounded-sm border border-input-border bg-card px-2 text-sm outline-none hover:border-input-border-hover focus-visible:border-orange-500";

export interface ReminderMember {
  id: string;
  name: string | null;
  email: string;
}

export interface ReminderRow {
  id: string;
  title: string;
  body: string | null;
  dueAt: string;
  dismissedAt: string | null;
  recipientName?: string;
  recipientId?: string;
  creatorName?: string;
  creatorId?: string;
  isMine: boolean;
}

/** `datetime-local` value for a Date — local time, minute precision. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

/** Popupy odświeżają się natychmiast zamiast czekać na kolejny tick. */
function announceChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("reminder:created"));
}

export function RemindersWorkspace({
  currentUserId,
  members,
  sent,
  received,
  oldCount,
  oldReceivedCount,
  defaultOpen = false,
}: {
  currentUserId: string;
  members: ReminderMember[];
  sent: ReminderRow[];
  received: ReminderRow[];
  // Count of MY reminders that the cleanup button would purge (past-due OR
  // dismissed). Drives whether the button renders and its label.
  oldCount: number;
  // Same idea for the "Dla mnie" section — counts received reminders the
  // recipient could soft-hide (past-due OR dismissed).
  oldReceivedCount: number;
  /** `?new=1` z menu „Utwórz" w top barze. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-ui="reminders" className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Przypomnienia</h1>
        <span className="mt-1.5 text-xs text-fg-2">
          {sent.length + received.length} aktywnych
        </span>
        <span className="flex-1" />
        {!open && (
          <Button type="button" onClick={() => setOpen(true)}>
            <IconPlus />
            Dodaj przypomnienie
          </Button>
        )}
      </header>

      <p className="max-w-[80ch] text-xs text-fg-2">
        Przypomnienia wyskakują jako dymek w prawym górnym rogu, gdy nadejdzie ich termin. Możesz
        wysłać je sobie albo osobie z Twoich przestrzeni.
      </p>

      {open && (
        <ReminderForm
          currentUserId={currentUserId}
          members={members}
          onClose={() => setOpen(false)}
        />
      )}

      <Section
        title="Wysłane przeze mnie"
        items={sent}
        currentUserId={currentUserId}
        members={members}
        headerAction={oldCount > 0 ? <CleanupOldButton count={oldCount} /> : null}
      />
      <Section
        title="Dla mnie"
        items={received}
        currentUserId={currentUserId}
        members={members}
        headerAction={oldReceivedCount > 0 ? <HideOldReceivedButton count={oldReceivedCount} /> : null}
      />
    </div>
  );
}

function CleanupOldButton({ count }: { count: number }) {
  return (
    <form
      action={() => startTransition(() => deleteOldRemindersAction())}
      onSubmit={(e) => {
        if (
          !confirm(
            `Usunąć ${count} stare przypomnienia (przeszłe albo odhaczone)? Operacja jest nieodwracalna.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        title="Usuwa Twoje przypomnienia, które już minęły lub zostały odhaczone."
        className="text-danger-text"
      >
        <IconTrash width={12} height={12} /> Usuń stare ({count})
      </Button>
    </form>
  );
}

function HideOldReceivedButton({ count }: { count: number }) {
  return (
    <form action={() => startTransition(() => hideOldReceivedRemindersAction())}>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        title="Ukrywa z Twojej listy stare lub odhaczone przypomnienia od innych. Wysyłający dalej je widzi."
      >
        <IconEyeOff width={12} height={12} /> Ukryj stare ({count})
      </Button>
    </form>
  );
}

/** Jeden formularz dla „nowe" i „edytuj" — różni je tylko `reminder`. */
function ReminderForm({
  currentUserId,
  members,
  reminder,
  onClose,
}: {
  currentUserId: string;
  members: ReminderMember[];
  reminder?: ReminderRow;
  onClose: () => void;
}) {
  const editing = !!reminder;
  const [dueAt, setDueAt] = useState(() =>
    toLocalInput(reminder ? new Date(reminder.dueAt) : new Date(Date.now() + 60 * 60 * 1000)),
  );

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          if (editing) await updateReminderAction(fd);
          else await createReminderAction(fd);
          announceChange();
          onClose();
        })
      }
      className="flex flex-col gap-3 rounded-lg border border-border bg-canvas p-4"
    >
      {editing && <input type="hidden" name="id" value={reminder.id} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reminder-title">Tytuł</Label>
        <Input
          id="reminder-title"
          name="title"
          defaultValue={reminder?.title ?? ""}
          required
          autoFocus={!editing}
          maxLength={200}
          placeholder="O czym chcesz pamiętać?"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reminder-body">Opis (opcjonalny)</Label>
        <Textarea
          id="reminder-body"
          name="body"
          rows={2}
          maxLength={2000}
          defaultValue={reminder?.body ?? ""}
          placeholder="Dodatkowy kontekst…"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-due">Kiedy</Label>
          <Input
            id="reminder-due"
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
            className="w-[220px] font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-recipient">Komu</Label>
          <select
            id="reminder-recipient"
            name="recipientId"
            defaultValue={reminder?.recipientId ?? currentUserId}
            className={cn(SELECT, "w-[240px]")}
          >
            <option value={currentUserId}>Ty (sobie)</option>
            {members
              .filter((m) => m.id !== currentUserId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Anuluj
        </Button>
        <Button type="submit">{editing ? "Zapisz" : "Utwórz przypomnienie"}</Button>
      </div>
    </form>
  );
}

function Section({
  title,
  items,
  currentUserId,
  members,
  headerAction,
}: {
  title: string;
  items: ReminderRow[];
  currentUserId: string;
  members: ReminderMember[];
  headerAction?: React.ReactNode;
}) {
  // Still render the section when there are no items but a cleanup button is
  // pending — otherwise a section with 0 visible items would hide the only
  // way to purge dismissed/past entries below the visible threshold.
  if (items.length === 0 && !headerAction) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="eyebrow">{title}</span>
        <span className="font-mono text-2xs text-fg-3">{items.length}</span>
        <span className="h-px flex-1 bg-border" />
        {headerAction}
      </div>
      {items.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-border">
          {items.map((r) => (
            <ReminderRowCard key={r.id} reminder={r} currentUserId={currentUserId} members={members} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReminderRowCard({
  reminder,
  currentUserId,
  members,
}: {
  reminder: ReminderRow;
  currentUserId: string;
  members: ReminderMember[];
}) {
  // eslint-disable-next-line react-hooks/purity
  const overdue = new Date(reminder.dueAt).getTime() < Date.now();
  const dismissed = !!reminder.dismissedAt;
  const isOwnCreator = reminder.creatorId === currentUserId;
  const isOwnRecipient = reminder.recipientId === currentUserId;
  const [editing, setEditing] = useState(false);

  if (editing && isOwnCreator) {
    return (
      <li className="border-b border-n-100 last:border-b-0">
        <ReminderForm
          reminder={reminder}
          currentUserId={currentUserId}
          members={members}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-n-100 bg-card px-3.5 py-2 last:border-b-0 max-md:flex-wrap">
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full",
          dismissed ? "bg-n-100 text-fg-3" : overdue ? "bg-chip-red-bg text-danger-text" : "bg-orange-100 text-orange-800",
        )}
      >
        <IconBell width={14} height={14} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{reminder.title}</span>
        {reminder.body && <span className="truncate text-xs text-fg-2">{reminder.body}</span>}
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-fg-3">
          <span className={cn("inline-flex items-center gap-1", overdue && "text-danger-text")}>
            <IconRecent width={11} height={11} /> {formatDateTime(reminder.dueAt)}
          </span>
          {reminder.isMine && reminder.recipientName && (
            <span className="inline-flex items-center gap-1">
              <IconUser width={11} height={11} /> dla {reminder.recipientName}
            </span>
          )}
          {!reminder.isMine && reminder.creatorName && (
            <span className="inline-flex items-center gap-1">
              <IconUser width={11} height={11} /> od {reminder.creatorName}
            </span>
          )}
          {dismissed && <span>schowane</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 max-md:w-full max-md:flex-wrap">
        {isOwnRecipient && !dismissed && (
          <form action={(fd) => startTransition(() => dismissReminderAction(fd))}>
            <input type="hidden" name="id" value={reminder.id} />
            <Button type="submit" variant="secondary" size="sm" title="Schowaj (nie usuwa — twórca nadal widzi)">
              <IconBell width={12} height={12} /> Schowaj
            </Button>
          </form>
        )}

        {isOwnRecipient && !reminder.isMine && (
          <form action={(fd) => startTransition(() => hideReceivedReminderAction(fd))}>
            <input type="hidden" name="id" value={reminder.id} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              title="Ukrywa to przypomnienie z Twojej listy. Wysyłający nadal je widzi."
            >
              <IconEyeOff width={12} height={12} /> Ukryj
            </Button>
          </form>
        )}

        {isOwnCreator && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)} title="Edytuj przypomnienie">
            <IconPen width={12} height={12} /> Edytuj
          </Button>
        )}

        {isOwnCreator && (
          <form action={(fd) => startTransition(() => deleteReminderAction(fd))}>
            <input type="hidden" name="id" value={reminder.id} />
            <Button type="submit" variant="secondary" size="sm" title="Usuń przypomnienie" className="text-danger-text">
              <IconTrash width={12} height={12} /> Usuń
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}
