"use client";

import { useActionState, startTransition, useEffect, useRef } from "react";
import { Mail, MessageCircle, Send } from "lucide-react";
import {
  sendContactMessageAction,
  type ContactMessageState,
} from "@/app/(app)/w/[workspaceId]/contacts/actions";
import {
  SearchableDropdown,
  type SearchableDropdownOption,
} from "@/components/ui/searchable-dropdown";

export interface ContactMessageRow {
  id: string;
  direction: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyText: string;
  sentAt: string;
  senderName: string | null;
}

export interface ContactConversationSender {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export function ContactConversation({
  workspaceId,
  contactId,
  contactEmail,
  contactLabel,
  messages,
  senderCandidates,
  defaultSenderEmail,
  canSend,
}: {
  workspaceId: string;
  contactId: string;
  contactEmail: string | null;
  contactLabel: string;
  messages: ContactMessageRow[];
  // Lista user'ów z workspace których email może być użyty jako "from".
  // Domyślnie opiekun kontaktu (jeśli ustawiony), inaczej bieżący user.
  senderCandidates: ContactConversationSender[];
  defaultSenderEmail: string | null;
  canSend: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow inline-flex items-center gap-1.5">
            <MessageCircle size={11} /> Konwersacja
          </span>
          <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
            Pisz do {contactLabel}
          </h2>
        </div>
        {contactEmail && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            <Mail size={10} /> {contactEmail}
          </span>
        )}
      </div>

      {!contactEmail && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[0.86rem] text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
          Kontakt nie ma adresu email — uzupełnij w karcie, żeby móc pisać.
        </p>
      )}

      <MessageThread messages={messages} />

      {canSend && contactEmail && (
        <Composer
          workspaceId={workspaceId}
          contactId={contactId}
          senderCandidates={senderCandidates}
          defaultSenderEmail={defaultSenderEmail}
        />
      )}
    </section>
  );
}

function MessageThread({ messages }: { messages: ContactMessageRow[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Auto-scroll do dołu gdy lista urośnie (nowa wiadomość po wysyłce).
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-[0.86rem] text-muted-foreground">
        Brak wiadomości. Napisz pierwszego maila do klienta poniżej.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card px-3 py-3">
      <ul className="flex flex-col gap-3">
        {messages.map((m) => {
          const isOutbound = m.direction === "outbound";
          return (
            <li
              key={m.id}
              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[80%] flex-col gap-1 rounded-2xl px-3 py-2 ${
                  isOutbound
                    ? "bg-brand-gradient text-white"
                    : "bg-muted/40 text-foreground"
                }`}
              >
                <div
                  className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                    isOutbound ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  <span>{m.senderName ?? m.fromEmail}</span>
                  <span>·</span>
                  <span>{formatRelative(m.sentAt)}</span>
                </div>
                {m.subject && (
                  <div
                    className={`text-[0.78rem] font-semibold ${isOutbound ? "text-white" : "text-foreground"}`}
                  >
                    {m.subject}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-[0.88rem] leading-[1.5]">
                  {m.bodyText}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={endRef} />
    </div>
  );
}

function Composer({
  workspaceId,
  contactId,
  senderCandidates,
  defaultSenderEmail,
}: {
  workspaceId: string;
  contactId: string;
  senderCandidates: ContactConversationSender[];
  defaultSenderEmail: string | null;
}) {
  const boundAction = sendContactMessageAction.bind(null, workspaceId, contactId);
  const [state, formAction, pending] = useActionState<ContactMessageState, FormData>(
    boundAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset formularza po wysyłce. Pozostawiamy domyślny senderEmail.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      if (subjectRef.current) subjectRef.current.value = "";
      if (bodyRef.current) bodyRef.current.value = "";
    }
  }, [state]);

  const senderOptions: SearchableDropdownOption[] = senderCandidates.map(
    (s) => ({
      id: s.email,
      label: s.name ?? s.email,
      sublabel: s.email,
      searchText: `${s.name ?? ""} ${s.email}`,
      leading: (
        <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.55rem] font-bold text-white">
          {s.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (s.name ?? s.email).slice(0, 2).toUpperCase()
          )}
        </span>
      ),
    }),
  );

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            Z którego maila piszesz
          </span>
          <SearchableDropdown
            name="fromEmail"
            value={defaultSenderEmail}
            options={senderOptions}
            required
            allowClear={false}
            placeholder="Wybierz nadawcę…"
            searchPlaceholder="Szukaj po imię lub email…"
            ariaLabel="Email nadawcy"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            Temat (opcjonalnie)
          </span>
          <input
            ref={subjectRef}
            name="subject"
            type="text"
            maxLength={200}
            placeholder="np. Re: oferta na Q3"
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
          Wiadomość
        </span>
        <textarea
          ref={bodyRef}
          name="body"
          required
          maxLength={20000}
          rows={4}
          placeholder="Cześć, dziękuję za rozmowę…"
          className="min-h-[110px] rounded-md border border-border bg-background p-3 text-[0.92rem] leading-[1.55] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>

      {state && !state.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.82rem] text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">
          Reply-To = Twój email. Odpowiedzi klienta trafią do Twojej skrzynki.
        </span>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-4 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={13} /> {pending ? "Wysyłam…" : "Wyślij"}
        </button>
      </div>
    </form>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "przed chwilą";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min temu`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h temu`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} d temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
