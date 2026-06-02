"use client";

import { useActionState, startTransition } from "react";
import {
  createDealAction,
  updateDealAction,
  type DealFormState,
} from "@/app/(app)/w/[workspaceId]/sales/actions";

export interface DealInitial {
  id?: string;
  title: string;
  valueAmount: number | null;
  valueCurrency: string;
  expectedCloseAt: string | null; // ISO date OR yyyy-MM-dd
  stageId: string;
  ownerId: string | null;
  contactId: string | null;
}

export interface StageOption {
  id: string;
  name: string;
}

export interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

export interface ContactOption {
  id: string;
  label: string; // company / person fallback
}

export function DealForm({
  mode,
  workspaceId,
  initial,
  stages,
  members,
  contacts,
  defaultStageId,
}: {
  mode: "create" | "edit";
  workspaceId: string;
  initial: DealInitial | null;
  stages: StageOption[];
  members: MemberOption[];
  contacts: ContactOption[];
  // Optional pre-selection when create button comes from a specific stage column.
  defaultStageId?: string | null;
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
          className="h-10 rounded-md border border-border bg-background px-3 text-[0.95rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
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
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Waluta</span>
          <input
            name="valueCurrency"
            maxLength={6}
            defaultValue={initial?.valueCurrency ?? "PLN"}
            placeholder="PLN"
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] uppercase outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Planowane zamknięcie</span>
          <input
            name="expectedCloseAt"
            type="date"
            defaultValue={dateValue}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Etap *</span>
          <select
            name="stageId"
            required
            defaultValue={stageValue}
            aria-invalid={!!fieldErrors?.stageId}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {fieldErrors?.stageId && (
            <span className="font-mono text-[0.66rem] text-destructive">
              {fieldErrors.stageId}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Opiekun</span>
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

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Kontakt / klient</span>
          <select
            name="contactId"
            defaultValue={initial?.contactId ?? ""}
            className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary"
          >
            <option value="">— bez kontaktu —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
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
