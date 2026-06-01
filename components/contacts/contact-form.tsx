"use client";

import { useActionState, startTransition } from "react";
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

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-10"
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
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Przypisany do</span>
          <select
            name="ownerId"
            defaultValue={initial?.ownerId ?? ""}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary"
          >
            <option value="">— bez opiekuna —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {/* notesJson reserved for a richer editor later; v1 just collects nothing. */}
      <input type="hidden" name="notesJson" value="" />

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
          {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz kontakt"}
        </button>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </div>
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
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={!!error}
        className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
      />
      {error && (
        <span className="font-mono text-[0.66rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
