"use client";

import { useActionState, startTransition, useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { IconComment, IconMail, IconSend } from "@/components/ui/icons";
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
            <IconComment width={11} height={11} /> Konwersacja
          </span>
          <h2 className="text-md font-semibold">Pisz do {contactLabel}</h2>
        </div>
        {contactEmail && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            <IconMail width={10} height={10} /> {contactEmail}
          </span>
        )}
      </div>

      {!contactEmail && (
        <p className="rounded-sm border border-warning bg-chip-yellow-bg px-2.5 py-2 text-xs text-warning-text">
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
      <div className="rounded-lg border border-dashed border-input-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
        Brak wiadomości. Napisz pierwszego maila do klienta poniżej.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border bg-card p-3">
      <ul className="flex flex-col gap-3">
        {messages.map((m) => {
          const isOutbound = m.direction === "outbound";
          return (
            <li
              key={m.id}
              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[80%] flex-col gap-1 rounded-lg px-3 py-2 ${
                  isOutbound ? "bg-selected text-foreground" : "bg-n-100 text-foreground"
                }`}
              >
                <div
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-2xs text-muted-foreground"
                >
                  <span>{m.senderName ?? m.fromEmail}</span>
                  <span>·</span>
                  <span>{formatRelative(m.sentAt)}</span>
                </div>
                {m.subject && (
                  <div className="text-xs font-semibold text-foreground">{m.subject}</div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm">
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
      leading: <Avatar name={s.name ?? s.email} src={s.avatarUrl} size={24} />,
    }),
  );

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-n-700">Z którego maila piszesz</span>
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
          <span className="text-xs font-medium text-n-700">Temat (opcjonalnie)</span>
          <Input ref={subjectRef} name="subject" maxLength={200} placeholder="np. Re: oferta na Q3" />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-n-700">Wiadomość</span>
        <Textarea ref={bodyRef} name="body" required maxLength={20000} rows={4} placeholder="Cześć, dziękuję za rozmowę…" className="min-h-[110px]" />
      </label>

      {state && !state.ok && (
        <p className="rounded-sm border border-danger bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-fg-3">
          Reply-To = Twój email. Odpowiedzi klienta trafią do Twojej skrzynki.
        </span>
        <Button type="submit" loading={pending}>
          <IconSend /> {pending ? "Wysyłam…" : "Wyślij"}
        </Button>
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
