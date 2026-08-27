"use client";

import { useActionState, startTransition, useId, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableDropdown,
  type SearchableDropdownOption,
} from "@/components/ui/searchable-dropdown";
import {
  createContactAction,
  updateContactAction,
  type ContactFormState,
} from "@/app/(app)/w/[workspaceId]/contacts/actions";

export interface ContactInitial {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  nip: string | null;
  regon: string | null;
  vatNumber: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  ownerId: string | null;
}

export interface WorkspaceMemberOption {
  id: string;
  name: string | null;
  email: string;
  // Avatar dla SearchableDropdown leading slot. Fallback do inicjałów na
  // brand-gradient gdy null.
  avatarUrl?: string | null;
}

export function ContactForm({
  mode,
  workspaceId,
  initial,
  members,
}: {
  mode: "create" | "edit";
  workspaceId: string;
  initial: ContactInitial | null;
  members: WorkspaceMemberOption[];
}) {
  const isEdit = mode === "edit" && initial?.id;
  const boundAction = isEdit
    ? updateContactAction.bind(null, workspaceId, initial!.id!)
    : createContactAction.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    boundAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok
    ? state?.error ?? state?.fieldErrors?._form
    : undefined;
  const flash = state?.ok ? state.message : null;

  // Klient: native <select> dla opiekuna był nieczytelny — lista emaili w
  // jednolitym stylu. SearchableDropdown daje avatar/inicjały + search po
  // imię/email + większy hit area.
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? "");
  const ownerOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      members.map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
        sublabel: m.email,
        searchText: `${m.name ?? ""} ${m.email}`,
        leading: <Avatar name={m.name ?? m.email} src={m.avatarUrl} size={24} />,
      })),
    [members],
  );

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-6"
    >
      <Section title="Osoba" eyebrow="Kontaktowa">
        <Field label="Imię" name="firstName" defaultValue={initial?.firstName ?? ""} error={fieldErrors?.firstName} />
        <Field label="Nazwisko" name="lastName" defaultValue={initial?.lastName ?? ""} error={fieldErrors?.lastName} />
        <Field label="Stanowisko" name="position" defaultValue={initial?.position ?? ""} placeholder="np. CEO, Project Manager" />
        <Field label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} error={fieldErrors?.email} />
        <Field label="Telefon" name="phone" defaultValue={initial?.phone ?? ""} placeholder="+48 ..." />
      </Section>

      <Section title="Firma" eyebrow="Kontrahent">
        <Field label="Nazwa firmy" name="companyName" defaultValue={initial?.companyName ?? ""} />
        <Field label="NIP" name="nip" defaultValue={initial?.nip ?? ""} />
        <Field label="REGON" name="regon" defaultValue={initial?.regon ?? ""} />
        <Field label="VAT EU" name="vatNumber" defaultValue={initial?.vatNumber ?? ""} placeholder="np. PL1234567890" />
        <Field label="Strona www" name="website" defaultValue={initial?.website ?? ""} placeholder="https://…" />
      </Section>

      <Section title="Adres" eyebrow="Lokalizacja">
        <Field label="Ulica i numer" name="street" defaultValue={initial?.street ?? ""} />
        <Field label="Kod pocztowy" name="postalCode" defaultValue={initial?.postalCode ?? ""} placeholder="00-000" />
        <Field label="Miasto" name="city" defaultValue={initial?.city ?? ""} />
        <Field label="Kraj" name="country" defaultValue={initial?.country ?? "PL"} placeholder="PL" />
      </Section>

      <Section title="Opiekun" eyebrow="Wewnętrzny">
        <div className="flex flex-col gap-1.5">
          {/* SearchableDropdown owns its own button + aria-label; the copy is
              decorative only, so a plain span (no htmlFor target) is fine. */}
          <span className="text-xs font-medium text-n-700">Przypisany do</span>
          <SearchableDropdown
            name="ownerId"
            value={ownerId}
            onChange={(v) => setOwnerId(v)}
            options={ownerOptions}
            placeholder="— bez opiekuna —"
            emptyLabel="— bez opiekuna —"
            searchPlaceholder="Szukaj po imię lub email…"
            ariaLabel="Opiekun kontaktu"
          />
        </div>
      </Section>

      {/* notesJson reserved for a richer editor later; v1 just collects nothing. */}
      <input type="hidden" name="notesJson" value="" />

      {formError && (
        <p className="rounded-sm border border-danger bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text">
          {formError}
        </p>
      )}
      {flash && (
        <p className="rounded-sm border border-success bg-chip-green-bg px-2.5 py-2 text-xs text-success-text">
          {flash}
        </p>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" loading={pending} size="lg">
          {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz kontakt"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="text-md font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  placeholder,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
}) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        error={error}
        className="max-md:h-11"
      />
    </div>
  );
}
