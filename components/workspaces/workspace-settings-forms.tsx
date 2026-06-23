"use client";

import { useActionState, useState, startTransition } from "react";
import {
  deleteWorkspaceAction,
  updateWorkspaceAction,
  type WorkspaceFormState,
} from "@/app/(app)/workspaces/actions";

export function UpdateWorkspaceForm({
  workspaceId,
  initialName,
  initialDescription,
}: {
  workspaceId: string;
  initialName: string;
  initialDescription: string | null;
}) {
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    updateWorkspaceAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const flash = state?.ok ? "Zapisano." : null;

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={workspaceId} />

      <TextInput
        label="Nazwa"
        name="name"
        defaultValue={initialName}
        required
        maxLength={60}
        error={fieldErrors?.name}
      />
      <TextArea
        label="Opis"
        name="description"
        defaultValue={initialDescription ?? ""}
        maxLength={280}
        error={fieldErrors?.description}
      />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </button>
        {flash && (
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
            {flash}
          </span>
        )}
      </div>
    </form>
  );
}

export function DeleteWorkspaceForm({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    deleteWorkspaceAction,
    null,
  );

  const fieldError = !state?.ok ? state?.fieldErrors?.confirmName : undefined;
  const formError = !state?.ok ? state?.error : undefined;

  if (!expanded) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
          Usunięcie przestrzeni jest <span className="text-foreground">nieodwracalne</span>.
          Wszystkie tablice, zadania, komentarze i załączniki zostaną oznaczone jako
          usunięte.
        </p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start rounded-lg border border-destructive/40 px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-visible:bg-destructive/5 focus-visible:outline-none"
        >
          Usuń przestrzeń
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-4 rounded-lg border border-destructive/40 p-5"
    >
      <input type="hidden" name="id" value={workspaceId} />
      <p className="text-[0.92rem] leading-[1.55]">
        Aby potwierdzić, wpisz dokładną nazwę:{" "}
        <span className="font-mono text-foreground">{workspaceName}</span>
      </p>
      <label className="flex flex-col gap-2">
        <span className="eyebrow">Potwierdzenie</span>
        <input
          name="confirmName"
          type="text"
          required
          autoComplete="off"
          autoFocus
          className="h-12 border-b border-border bg-transparent pb-1 font-mono text-[16px] outline-none focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 md:h-10 md:text-[0.95rem]"
        />
        {fieldError && (
          <span className="font-mono text-[0.68rem] text-destructive">{fieldError}</span>
        )}
      </label>
      {formError && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-destructive px-5 font-sans text-[0.9rem] font-semibold text-white transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-60"
        >
          {pending ? "Usuwam…" : "Tak, usuń nieodwracalnie"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function TextInput({
  label,
  name,
  defaultValue,
  required,
  maxLength,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-invalid={!!error}
        // Mobile v4: 48px tap target + 16px text prevents iOS auto-zoom.
        className="h-12 border-b border-border bg-transparent pb-1 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive md:h-10 md:text-[1rem]"
      />
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive">{error}</span>
      )}
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  maxLength,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  maxLength?: number;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={!!error}
        className="min-h-[3.5rem] resize-none border-b border-border bg-transparent pb-1 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive md:min-h-[3rem] md:text-[1rem]"
      />
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
