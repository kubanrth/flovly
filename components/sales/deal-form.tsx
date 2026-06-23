"use client";

import { useActionState, startTransition, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import {
  createDealAction,
  updateDealAction,
  type DealFormState,
} from "@/app/(app)/w/[workspaceId]/sales/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  SearchableDropdown,
  type SearchableDropdownOption,
} from "@/components/ui/searchable-dropdown";

export interface DealInitial {
  id?: string;
  title: string;
  valueAmount: number | null;
  valueCurrency: string;
  expectedCloseAt: string | null; // ISO date OR yyyy-MM-dd
  stageId: string;
  ownerId: string | null;
  contactId: string | null;
  notesJson: RichTextDoc | null;
  // F12-K66: przypomnienie cron'owe dla owner'a. ISO datetime.
  reminderAt: string | null;
  // F12-K71: opcjonalna treść do przypomnienia, leci jako blockquote
  // w mailu cron'a. Plain text, ~500 chars max.
  reminderNote: string | null;
}

export interface StageOption {
  id: string;
  name: string;
  // Kolor etapu — w dropdown'ie pokazujemy kropkę żeby user nie musiał
  // pamiętać kolejności / kolorów po nazwie.
  colorHex: string;
}

export interface MemberOption {
  id: string;
  name: string | null;
  email: string;
  // Avatar w dropdown'ie + zaznaczonej opcji. Fallback do inicjałów na
  // brand-gradient (mirror reszty app'a).
  avatarUrl: string | null;
}

export interface ContactOption {
  id: string;
  label: string; // company / person fallback
  // Opcjonalny sub-label (np. email albo telefon) — wyświetlany pod główną
  // linią w dropdown'ie żeby ujednoznacznić "Anna Kowalska" w dwóch firmach.
  sublabel?: string | null;
}

export function DealForm({
  mode,
  workspaceId,
  initial,
  stages,
  members,
  contacts,
  defaultStageId,
  defaultContactId,
}: {
  mode: "create" | "edit";
  workspaceId: string;
  initial: DealInitial | null;
  stages: StageOption[];
  members: MemberOption[];
  contacts: ContactOption[];
  // Optional pre-selection when create button comes from a specific stage column.
  defaultStageId?: string | null;
  // Pre-selected contact (e.g. when creating from a contact's detail page).
  defaultContactId?: string | null;
}) {
  const isEdit = mode === "edit" && initial?.id;
  const boundAction = isEdit
    ? updateDealAction.bind(null, workspaceId, initial!.id!)
    : createDealAction.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<DealFormState, FormData>(
    boundAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error ?? state?.fieldErrors?._form : undefined;
  const flash = state?.ok ? state.message : null;

  const stageValue = initial?.stageId ?? defaultStageId ?? stages[0]?.id ?? "";
  const dateValue =
    initial?.expectedCloseAt && initial.expectedCloseAt.length > 0
      ? initial.expectedCloseAt.slice(0, 10)
      : "";

  // Client state dla 3 dropdown'ów — wcześniej natywne <select> trzymały
  // wartość same; teraz controlled żeby ChevronDown + Check + reset działały
  // spójnie + żeby search nie tracił wybranej opcji po focus'ie.
  const [stageId, setStageId] = useState(stageValue);
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? "");
  const [contactId, setContactId] = useState(
    initial?.contactId ?? defaultContactId ?? "",
  );

  const stageOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      stages.map((s) => ({
        id: s.id,
        label: s.name,
        leading: (
          <span
            className="grid h-3 w-3 shrink-0 place-items-center rounded-full"
            style={{ background: s.colorHex }}
          />
        ),
      })),
    [stages],
  );

  const ownerOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      members.map((m) => {
        const display = m.name ?? m.email.split("@")[0];
        const initials = (m.name ?? m.email).slice(0, 2).toUpperCase();
        return {
          id: m.id,
          label: display,
          sublabel: m.email,
          searchText: `${m.name ?? ""} ${m.email}`,
          leading: (
            <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.55rem] font-bold text-white">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </span>
          ),
        };
      }),
    [members],
  );

  const contactOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      contacts.map((c) => ({
        id: c.id,
        label: c.label,
        sublabel: c.sublabel ?? null,
        searchText: `${c.label} ${c.sublabel ?? ""}`,
      })),
    [contacts],
  );

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-6"
    >
      <label className="flex flex-col gap-2">
        <span className="eyebrow">Tytuł deala *</span>
        <input
          name="title"
          required
          maxLength={200}
          autoFocus
          defaultValue={initial?.title ?? ""}
          placeholder="np. Wdrożenie systemu CRM dla XYZ Sp. z o.o."
          aria-invalid={!!fieldErrors?.title}
          className="h-10 rounded-md border border-border bg-background px-3 text-[0.95rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
        />
        {fieldErrors?.title && (
          <span className="font-mono text-[0.66rem] text-destructive">
            {fieldErrors.title}
          </span>
        )}
      </label>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Wartość</span>
          <input
            name="valueAmount"
            inputMode="decimal"
            defaultValue={initial?.valueAmount != null ? String(initial.valueAmount) : ""}
            placeholder="0,00"
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Waluta</span>
          <input
            name="valueCurrency"
            maxLength={6}
            defaultValue={initial?.valueCurrency ?? "PLN"}
            placeholder="PLN"
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] uppercase outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Planowane zamknięcie</span>
          <input
            name="expectedCloseAt"
            type="date"
            defaultValue={dateValue}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
      </div>

      {/* F12-K71 v2: reminder w osobnym brand-purple card'zie (mirror
          NewReminderForm w /my/reminders). Klient: "przypomnienie wygląda
          jakby niezapisane, wykorzystajmy wygląd modułu przypomnienia z
          głównego widoku". Dotąd były to zwykłe inline pola w grid'zie, więc
          po zapisie textarea wracała do "Brak przypomnienia" placeholder'a
          i user nie miał feedback'u że coś zostało zapisane.
          Cron /api/cron/send-reminders co 15 min skanuje gdy reminderAt < now
          i reminderSentAt = null. Re-arming czyści reminderSentAt. */}
      <div className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="flex items-baseline gap-2">
          <Bell size={13} className="text-primary" />
          <span className="eyebrow">Przypomnienie email</span>
          {initial?.reminderAt && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300">
              <Check size={9} /> ustawione
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Kiedy wysłać</span>
          <DateTimePicker
            name="reminderAt"
            defaultValue={initial?.reminderAt ?? null}
            placeholder="Wybierz datę i godzinę"
            label="Termin przypomnienia"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Treść (opcjonalna)</span>
          <textarea
            name="reminderNote"
            defaultValue={initial?.reminderNote ?? ""}
            maxLength={500}
            rows={3}
            placeholder='Co Ci ma się przypomnieć? np. „zadzwonić w sprawie umowy"…'
            className="min-h-[80px] resize-y rounded-md border border-border bg-background p-2.5 text-[0.88rem] leading-[1.55] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">
            wkleja się w mailu jako blockquote pod tytułem deal'a
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Etap *</span>
          <SearchableDropdown
            name="stageId"
            value={stageId}
            onChange={(v) => setStageId(v)}
            options={stageOptions}
            required
            placeholder="Wybierz etap…"
            searchPlaceholder="Szukaj etapu…"
            ariaLabel="Etap dealu"
            invalid={!!fieldErrors?.stageId}
          />
          {fieldErrors?.stageId && (
            <span className="font-mono text-[0.66rem] text-destructive">
              {fieldErrors.stageId}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">Opiekun</span>
          <SearchableDropdown
            name="ownerId"
            value={ownerId}
            onChange={(v) => setOwnerId(v)}
            options={ownerOptions}
            placeholder="— bez opiekuna —"
            emptyLabel="— bez opiekuna —"
            searchPlaceholder="Szukaj po imieniu lub email…"
            ariaLabel="Opiekun dealu"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">Kontakt / klient</span>
          <SearchableDropdown
            name="contactId"
            value={contactId}
            onChange={(v) => setContactId(v)}
            options={contactOptions}
            placeholder="— bez kontaktu —"
            emptyLabel="— bez kontaktu —"
            searchPlaceholder="Szukaj po firmie, nazwie, NIP…"
            ariaLabel="Kontakt dealu"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Notatki</span>
        <RichTextEditor
          name="notesJson"
          initial={initial?.notesJson ?? null}
          readOnly={false}
          placeholder="Kontekst, ustalenia, kolejne kroki…"
        />
      </div>

      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.88rem] text-destructive">
          {formError}
        </div>
      )}
      {flash && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.88rem] text-emerald-700 dark:text-emerald-300">
          {flash}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz deal"}
        </button>
      </div>
    </form>
  );
}
