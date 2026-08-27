"use client";

import { useActionState, startTransition, useId, useMemo, useState } from "react";
import {
  createDealAction,
  updateDealAction,
  type DealFormState,
} from "@/app/(app)/w/[workspaceId]/sales/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { IconReminders } from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
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

  // Stable per-field IDs for label htmlFor= associations.
  const titleId = useId();
  const valueId = useId();
  const currencyId = useId();
  const closeDateId = useId();
  const reminderNoteId = useId();

  const stageOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      stages.map((s) => ({
        id: s.id,
        label: s.name,
        leading: (
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ background: s.colorHex }}
          />
        ),
      })),
    [stages],
  );

  const ownerOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      members.map((m) => {
        const display = m.name ?? m.email.split("@")[0]!;
        return {
          id: m.id,
          label: display,
          sublabel: m.email,
          searchText: `${m.name ?? ""} ${m.email}`,
          leading: <Avatar name={display} src={m.avatarUrl} size={22} />,
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
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="eyebrow">Tytuł deala *</label>
        <Input
          id={titleId}
          name="title"
          required
          maxLength={200}
          autoFocus
          defaultValue={initial?.title ?? ""}
          placeholder="np. Wdrożenie systemu CRM dla XYZ Sp. z o.o."
          error={fieldErrors?.title}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={valueId} className="eyebrow">Wartość</label>
          <Input
            id={valueId}
            name="valueAmount"
            inputMode="decimal"
            defaultValue={initial?.valueAmount != null ? String(initial.valueAmount) : ""}
            placeholder="0,00"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={currencyId} className="eyebrow">Waluta</label>
          <Input
            id={currencyId}
            name="valueCurrency"
            maxLength={6}
            defaultValue={initial?.valueCurrency ?? "PLN"}
            placeholder="PLN"
            className="font-mono uppercase"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={closeDateId} className="eyebrow">Planowane zamknięcie</label>
          <Input id={closeDateId} name="expectedCloseAt" type="date" defaultValue={dateValue} />
        </div>
      </div>

      {/* F12-K71 v2: reminder w osobnym brand-purple card'zie (mirror
          NewReminderForm w /my/reminders). Klient: "przypomnienie wygląda
          jakby niezapisane, wykorzystajmy wygląd modułu przypomnienia z
          głównego widoku". Dotąd były to zwykłe inline pola w grid'zie, więc
          po zapisie textarea wracała do "Brak przypomnienia" placeholder'a
          i user nie miał feedback'u że coś zostało zapisane.
          Cron /api/cron/send-reminders co 15 min skanuje gdy reminderAt < now
          i reminderSentAt = null. Re-arming czyści reminderSentAt. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-canvas p-4">
        <div className="flex items-center gap-2">
          <IconReminders width={14} height={14} className="text-muted-foreground" />
          <span className="eyebrow">Przypomnienie email</span>
          {initial?.reminderAt && (
            <Chip hue="green" dot size="sm" className="ml-auto">Ustawione</Chip>
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
          <label htmlFor={reminderNoteId} className="eyebrow">Treść (opcjonalna)</label>
          <Textarea
            id={reminderNoteId}
            name="reminderNote"
            defaultValue={initial?.reminderNote ?? ""}
            maxLength={500}
            rows={3}
            placeholder='Co Ci ma się przypomnieć? np. „zadzwonić w sprawie umowy"…'
            className="min-h-20 resize-y"
          />
          <span className="text-xs text-muted-foreground">
            Wkleja się w mailu jako cytat pod tytułem deala.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
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
          {fieldErrors?.stageId && <span className="text-xs text-danger-text">{fieldErrors.stageId}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Notatki</span>
        <RichTextEditor
          name="notesJson"
          initial={initial?.notesJson ?? null}
          readOnly={false}
          placeholder="Kontekst, ustalenia, kolejne kroki…"
        />
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-border bg-chip-red-bg px-3 py-2 text-sm text-danger-text">
          {formError}
        </p>
      )}
      {flash && (
        <p role="status" className="rounded-md border border-border bg-chip-green-bg px-3 py-2 text-sm text-success-text">
          {flash}
        </p>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" size="lg" loading={pending} disabled={pending}>
          {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz deal"}
        </Button>
      </div>
    </form>
  );
}
