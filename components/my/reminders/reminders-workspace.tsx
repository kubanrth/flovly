"use client";

import { startTransition, useState } from "react";
import { Bell, BellOff, Clock, EyeOff, Pencil, Plus, Trash2, User as UserIcon } from "lucide-react";
import {
  createReminderAction,
  deleteOldRemindersAction,
  deleteReminderAction,
  dismissReminderAction,
  hideOldReceivedRemindersAction,
  hideReceivedReminderAction,
  updateReminderAction,
} from "@/app/(app)/my/reminders/actions";

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

export function RemindersWorkspace({
  currentUserId,
  members,
  sent,
  received,
  oldCount,
  oldReceivedCount,
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
}) {
  return (
    <div className="flex flex-col gap-8 max-md:gap-6 max-md:pb-[max(5rem,calc(4rem+env(safe-area-inset-bottom)))]">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Prywatne</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em] max-md:text-[1.7rem]">
          Twoje <span className="text-brand-gradient">przypomnienia</span>.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Przypomnienia wyskakują jako dymek w prawym górnym rogu gdy
          nadejdzie ich termin. Możesz je wysłać sobie lub członkom
          workspace'u.
        </p>
      </div>

      <NewReminderForm currentUserId={currentUserId} members={members} />

      <Section
        title="Wysłane przeze mnie"
        items={sent}
        currentUserId={currentUserId}
        members={members}
        headerAction={
          oldCount > 0 ? (
            <CleanupOldButton count={oldCount} />
          ) : null
        }
      />
      <Section
        title="Dla mnie"
        items={received}
        currentUserId={currentUserId}
        members={members}
        headerAction={
          oldReceivedCount > 0 ? (
            <HideOldReceivedButton count={oldReceivedCount} />
          ) : null
        }
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
      className="m-0"
    >
      <button
        type="submit"
        title="Usuwa Twoje przypomnienia które już minęły lub zostały odhaczone."
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        <Trash2 size={11} /> Usuń stare ({count})
      </button>
    </form>
  );
}

function HideOldReceivedButton({ count }: { count: number }) {
  return (
    <form
      action={() => startTransition(() => hideOldReceivedRemindersAction())}
      className="m-0"
    >
      <button
        type="submit"
        title="Ukrywa z Twojej listy stare lub odhaczone przypomnienia od innych. Wysyłający dalej je widzi."
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <EyeOff size={11} /> Ukryj stare ({count})
      </button>
    </form>
  );
}

function NewReminderForm({
  currentUserId,
  members,
}: {
  currentUserId: string;
  members: ReminderMember[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    // Default to 1 hour from now so "Create" works out-of-the-box.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [recipientId, setRecipientId] = useState(currentUserId);

  if (!open) {
    // Mobile: fixed sticky-bottom full-width button z safe-area inset.
    // Desktop: inline button na flow.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] max-md:fixed max-md:inset-x-4 max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:z-30 max-md:h-12 max-md:w-auto max-md:justify-center max-md:text-[0.95rem]"
      >
        <Plus size={14} /> <span className="max-md:hidden">Dodaj przypomnienie</span><span className="hidden max-md:inline">Nowe przypomnienie</span>
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createReminderAction(fd);
          // Trigger immediate popup refresh — skips 20s tick wait in ReminderPopups.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("reminder:created"));
          }
          setOpen(false);
          setTitle("");
          setBody("");
        })
      }
      className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
    >
      <input type="hidden" name="recipientId" value={recipientId} />
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Tytuł</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          maxLength={200}
          placeholder="O czym chcesz pamiętać?"
          className="h-10 border-b border-border bg-transparent pb-1 font-display text-[1.1rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Opis (opcjonalny)</span>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Dodatkowy kontekst…"
          className="min-h-[3rem] resize-none rounded-md border border-border bg-background p-2 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Kiedy</span>
          <input
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
            className="h-9 rounded-md border border-border bg-background px-3 font-mono text-[0.8rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Komu</span>
          <RecipientPicker
            value={recipientId}
            onChange={setRecipientId}
            members={members}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
        >
          Utwórz przypomnienie
        </button>
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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="eyebrow text-primary">{title}</h2>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {items.length}
          </span>
        </div>
        {headerAction}
      </div>
      {items.length > 0 && (
        <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          {items.map((r) => (
            <ReminderRowCard
              key={r.id}
              reminder={r}
              currentUserId={currentUserId}
              members={members}
            />
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
  const due = new Date(reminder.dueAt);
  const overdue = due.getTime() < Date.now();
  const dismissed = !!reminder.dismissedAt;
  const isOwnCreator = reminder.creatorId === currentUserId;
  const isOwnRecipient = reminder.recipientId === currentUserId;
  // In-place edit. Only creator can toggle.
  const [editing, setEditing] = useState(false);
  if (editing && isOwnCreator) {
    return (
      <li className="border-b border-border last:border-b-0">
        <EditReminderForm
          reminder={reminder}
          currentUserId={currentUserId}
          members={members}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    // Mobile: stacked layout (icon+content row, akcje pod spodem jako chip row).
    <li className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:flex-wrap max-md:items-start max-md:gap-2.5 max-md:py-3.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          dismissed
            ? "bg-muted text-muted-foreground"
            : overdue
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}
        aria-hidden
      >
        {dismissed ? <BellOff size={14} /> : <Bell size={14} />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
          {reminder.title}
        </span>
        {reminder.body && (
          <span className="truncate text-[0.86rem] text-muted-foreground">
            {reminder.body}
          </span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
            <Clock size={10} /> {formatDateTime(reminder.dueAt)}
          </span>
          {reminder.isMine && reminder.recipientName && (
            <span className="inline-flex items-center gap-1">
              <UserIcon size={10} /> dla {reminder.recipientName}
            </span>
          )}
          {!reminder.isMine && reminder.creatorName && (
            <span className="inline-flex items-center gap-1">
              <UserIcon size={10} /> od {reminder.creatorName}
            </span>
          )}
          {dismissed && <span>schowane</span>}
        </div>
      </div>

      {/* F12-K20: actions teraz z widocznymi labelami zamiast samych
          ikon — klient zgłosił że 'brak edycji/usuwania', bo małe
          ikonki h-8 w-8 były niedostrzegalne. Każdy button ma teraz
          tekst + ikonę, tło bg-background z border, kolorowany hover.
          Mobile: wrap pod content, full-width row z snap-x scroll. */}
      <div className="flex shrink-0 items-center gap-1.5 max-md:w-full max-md:flex-wrap max-md:gap-2 max-md:pl-12">
        {/* Recipient-only dismiss */}
        {isOwnRecipient && !dismissed && (
          <form
            action={(fd) => startTransition(() => dismissReminderAction(fd))}
            className="m-0"
          >
            <input type="hidden" name="id" value={reminder.id} />
            <button
              type="submit"
              aria-label="Schowaj"
              title="Schowaj (nie usuwa — twórca nadal widzi)"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground max-md:h-11 max-md:px-3.5"
            >
              <BellOff size={12} /> Schowaj
            </button>
          </form>
        )}

        {/* Recipient-only soft-hide from list — for reminders received from
            others. Doesn't touch the row, only stamps recipientHiddenAt. */}
        {isOwnRecipient && !reminder.isMine && (
          <form
            action={(fd) => startTransition(() => hideReceivedReminderAction(fd))}
            className="m-0"
          >
            <input type="hidden" name="id" value={reminder.id} />
            <button
              type="submit"
              aria-label="Ukryj z mojej listy"
              title="Ukrywa to przypomnienie z Twojej listy. Wysyłający nadal je widzi."
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground max-md:h-11 max-md:px-3.5"
            >
              <EyeOff size={12} /> Ukryj
            </button>
          </form>
        )}

        {/* Creator-only edit (F11-13) */}
        {isOwnCreator && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edytuj przypomnienie"
            title="Edytuj przypomnienie"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground max-md:h-11 max-md:px-3.5"
          >
            <Pencil size={12} /> Edytuj
          </button>
        )}

        {/* Creator-only delete */}
        {isOwnCreator && (
          <form
            action={(fd) => startTransition(() => deleteReminderAction(fd))}
            className="m-0"
          >
            <input type="hidden" name="id" value={reminder.id} />
            <button
              type="submit"
              aria-label="Usuń przypomnienie"
              title="Usuń przypomnienie"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive max-md:h-11 max-md:px-3.5"
            >
              <Trash2 size={12} /> Usuń
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

// Inline edit. Same shape as the create form but pre-filled.
function EditReminderForm({
  reminder,
  currentUserId,
  members,
  onClose,
}: {
  reminder: ReminderRow;
  currentUserId: string;
  members: ReminderMember[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [body, setBody] = useState(reminder.body ?? "");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(reminder.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [recipientId, setRecipientId] = useState(reminder.recipientId ?? currentUserId);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updateReminderAction(fd);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("reminder:created"));
          }
          onClose();
        })
      }
      className="flex flex-col gap-3 bg-primary/5 p-4"
    >
      <input type="hidden" name="id" value={reminder.id} />
      <input type="hidden" name="recipientId" value={recipientId} />
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Tytuł</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="h-9 rounded-md border border-border bg-background px-2 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Opis</span>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          className="resize-none rounded-md border border-border bg-background p-2 text-[0.86rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Kiedy</span>
          <input
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
            className="h-9 rounded-md border border-border bg-background px-2 font-mono text-[0.78rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Komu</span>
          <RecipientPicker
            value={recipientId}
            onChange={setRecipientId}
            members={members}
            currentUserId={currentUserId}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Zapisz
        </button>
      </div>
    </form>
  );
}

// Rich recipient picker — avatars + search; replaces plain <select>.
function RecipientPicker({
  value,
  onChange,
  members,
  currentUserId,
}: {
  value: string;
  onChange: (id: string) => void;
  members: ReminderMember[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const self = { id: currentUserId, name: "Ty (sobie)", email: "", isSelf: true };
  const otherMembers = members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.email,
      email: m.name ? m.email : "",
      isSelf: false,
    }));

  const all = [self, ...otherMembers];
  const selected = all.find((m) => m.id === value) ?? self;

  const q = query.trim().toLowerCase();
  const filteredOthers = q
    ? otherMembers.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      )
    : otherMembers;
  const showSelf = !q || self.name.toLowerCase().includes(q);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 w-[240px] items-center gap-2 rounded-md border border-border bg-background px-3 text-left transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white"
          aria-hidden
        >
          {selected.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[0.86rem] font-medium">
            {selected.name}
          </span>
          {selected.email && (
            <span className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              {selected.email}
            </span>
          )}
        </span>
        <span
          className="ml-1 grid h-5 w-5 shrink-0 place-items-center text-muted-foreground"
          aria-hidden
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 flex w-[320px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]">
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj osoby…"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto p-1">
              {showSelf && (
                <>
                  <li className="px-2 pt-1.5 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                    Ty
                  </li>
                  <li>
                    <RecipientItem
                      member={self}
                      active={value === self.id}
                      onPick={(id) => {
                        onChange(id);
                        setOpen(false);
                        setQuery("");
                      }}
                    />
                  </li>
                </>
              )}
              {filteredOthers.length > 0 && (
                <>
                  <li className="mt-1 px-2 pt-1.5 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                    Członkowie workspace&apos;ów
                  </li>
                  {filteredOthers.map((m) => (
                    <li key={m.id}>
                      <RecipientItem
                        member={m}
                        active={value === m.id}
                        onPick={(id) => {
                          onChange(id);
                          setOpen(false);
                          setQuery("");
                        }}
                      />
                    </li>
                  ))}
                </>
              )}
              {!showSelf && filteredOthers.length === 0 && (
                <li className="px-3 py-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                  brak dopasowań
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function RecipientItem({
  member,
  active,
  onPick,
}: {
  member: { id: string; name: string; email: string; isSelf: boolean };
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(member.id)}
      data-active={active ? "true" : "false"}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[0.86rem] transition-colors hover:bg-accent data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white"
        aria-hidden
      >
        {member.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">{member.name}</span>
        {member.email && (
          <span className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
            {member.email}
          </span>
        )}
      </div>
      {active && <span className="font-mono text-[0.62rem] text-primary">✓</span>}
    </button>
  );
}
