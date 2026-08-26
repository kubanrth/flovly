"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { IconClose, IconMail, IconPen, IconPhone, IconPlus, IconSend } from "@/components/ui/icons";
import {
  sendContactMessageAction,
  type ContactMessageState,
} from "@/app/(app)/w/[workspaceId]/contacts/actions";
import {
  contactKind,
  contactName,
  KIND_HUE,
  KIND_LABEL,
  type ContactRow,
} from "./contact-model";
import { InitialsTile } from "./initials-tile";

export interface ContactBoardRef {
  id: string;
  name: string;
}

export interface ContactHistoryEntry {
  id: string;
  kind: "note" | "mail" | "call" | "event";
  actorName: string | null;
  text: string;
  /** Already formatted for display (mono, right after the text). */
  at: string;
}

const FIELD = "mb-2.5";
const FIELD_LABEL = "mb-[3px] text-2xs text-fg-3";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={FIELD}>
      <div className={FIELD_LABEL}>{label}</div>
      {children}
    </div>
  );
}

/**
 * E1 „Karta kontaktu” — 380px panel docked to the right of the table. Read-only
 * summary; every mutation lives on the full card page (pencil in the header).
 */
export function ContactCardPanel({
  workspaceId,
  contact,
  boards,
  people,
  history,
  canEdit,
  onClose,
}: {
  workspaceId: string;
  contact: ContactRow;
  boards: ContactBoardRef[];
  people: ContactRow[];
  history: ContactHistoryEntry[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const kind = contactKind(contact);
  const name = contactName(contact);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !composing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing, onClose]);

  return (
    <aside
      data-ui="contact-panel"
      aria-label="Karta kontaktu"
      className="absolute inset-y-0 right-0 z-(--z-panel) flex w-[380px] flex-col border-l border-border bg-card shadow-e2 max-md:w-full"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3.5">
        <h2 className="flex-1 truncate text-sm font-semibold">Karta kontaktu</h2>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Edytuj kontakt"
            render={<Link href={`/w/${workspaceId}/contacts/${contact.id}`} />}
          >
            <IconPen />
          </Button>
        )}
        <Button variant="ghost" size="sm" iconOnly aria-label="Zamknij kartę" onClick={onClose}>
          <IconClose />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
        <div className="mb-3.5 flex items-center gap-3">
          <InitialsTile label={name} kind={kind} size={44} />
          <div className="min-w-0">
            <div className="truncate text-md font-semibold">{name}</div>
            <Chip hue={KIND_HUE[kind]} size="sm" className="mt-[3px]">
              {KIND_LABEL[kind]}
            </Chip>
          </div>
        </div>

        <div className="mb-4 flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-[30px] flex-1"
            disabled={!canEdit || !contact.email}
            onClick={() => setComposing(true)}
          >
            <IconMail width={12} height={12} />
            Napisz
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-[30px] flex-1"
            disabled={!contact.phone}
            render={contact.phone ? <a href={`tel:${contact.phone.replace(/\s/g, "")}`} /> : undefined}
          >
            <IconPhone width={12} height={12} />
            Zadzwoń
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-[30px] flex-1"
            render={<Link href={`/w/${workspaceId}/contacts/${contact.id}#contact-tasks`} />}
          >
            <IconPlus width={12} height={12} />
            Zadanie
          </Button>
        </div>

        <Field label="E-mail">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="rounded-[2px] text-sm text-link outline-none hover:text-orange-800 hover:underline active:text-orange-900"
            >
              {contact.email}
            </a>
          ) : (
            <span className="text-sm text-fg-3">—</span>
          )}
        </Field>

        <Field label="Telefon">
          <span className="font-mono text-sm">{contact.phone ?? "—"}</span>
        </Field>

        <Field label="NIP">
          <span className="font-mono text-sm">{contact.nip ?? "—"}</span>
        </Field>

        <Field label="Powiązane tablice">
          {boards.length === 0 ? (
            <span className="text-xs text-fg-3">Brak</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {boards.map((b) => (
                <Chip key={b.id} size="sm" className="max-w-[160px] truncate">
                  {b.name}
                </Chip>
              ))}
            </span>
          )}
        </Field>

        <Field label="Osoby">
          {people.length === 0 ? (
            <span className="text-xs text-fg-3">Brak powiązanych osób</span>
          ) : (
            people.map((p) => {
              const label = contactName(p);
              return (
                <Link
                  key={p.id}
                  href={`/w/${workspaceId}/contacts/${p.id}`}
                  className="-mx-1 flex h-[30px] items-center gap-2 rounded-sm px-1 no-underline outline-none hover:bg-n-100 active:bg-n-200"
                >
                  <InitialsTile label={label} kind={contactKind(p)} size={22} />
                  <span className="flex-1 truncate text-xs text-foreground">{label}</span>
                  {p.position && <span className="shrink-0 text-2xs text-fg-3">{p.position}</span>}
                </Link>
              );
            })
          )}
        </Field>

        <div className="border-t border-n-100 pt-2.5">
          <div className="eyebrow mb-2">Historia</div>
          {history.length === 0 ? (
            <p className="text-xs text-fg-3">Brak zapisanej historii kontaktu.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {history.map((h) => (
                <li key={h.id} className="flex gap-2">
                  {h.kind === "note" && h.actorName ? (
                    <Avatar name={h.actorName} size={22} />
                  ) : (
                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-n-100 text-n-500 [&_svg]:size-[11px]">
                      {h.kind === "call" ? <IconPhone /> : <IconMail />}
                    </span>
                  )}
                  <span className="text-xs leading-[17px] text-muted-foreground">
                    {h.kind === "note" && h.actorName && (
                      <strong className="font-semibold text-foreground">{h.actorName}</strong>
                    )}
                    {h.kind === "note" && h.actorName ? " — " : ""}
                    {h.text}{" "}
                    <span className="font-mono text-[10px] whitespace-nowrap">· {h.at}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {composing && contact.email && (
        <ComposeDialog
          workspaceId={workspaceId}
          contactId={contact.id}
          to={contact.email}
          onClose={() => setComposing(false)}
        />
      )}
    </aside>
  );
}

function ComposeDialog({
  workspaceId,
  contactId,
  to,
  onClose,
}: {
  workspaceId: string;
  contactId: string;
  to: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<ContactMessageState, FormData>(
    sendContactMessageAction.bind(null, workspaceId, contactId),
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" data-ui="contact-compose">
        <form action={(fd) => startTransition(() => formAction(fd))}>
          <DialogHeader>
            <DialogTitle>Napisz do {to}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Temat</span>
              <Input name="subject" maxLength={200} placeholder="np. Re: oferta na Q3" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Wiadomość</span>
              <Textarea name="body" required maxLength={20000} rows={6} placeholder="Cześć, dziękuję za rozmowę…" />
            </label>
            {state && !state.ok && (
              <p className="rounded-sm border border-danger bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text">
                {state.error}
              </p>
            )}
            <p className="text-2xs text-fg-3">
              Reply-To = Twój adres. Odpowiedzi klienta trafią do Twojej skrzynki.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" loading={pending}>
              <IconSend />
              {pending ? "Wysyłam…" : "Wyślij"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
