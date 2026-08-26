"use client";

import { useActionState, useId, useState, startTransition } from "react";
import {
  deleteWorkspaceAction,
  updateWorkspaceAction,
  type WorkspaceFormState,
} from "@/app/(app)/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdateWorkspaceForm({
  workspaceId,
  initialName,
  initialDescription,
}: {
  workspaceId: string;
  initialName: string;
  initialDescription: string | null;
}) {
  const nameId = useId();
  const descId = useId();
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    updateWorkspaceAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const flash = state?.ok ? "Zapisano." : null;

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex max-w-[560px] flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <input type="hidden" name="id" value={workspaceId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Nazwa</Label>
        <Input id={nameId} name="name" defaultValue={initialName} required maxLength={60} error={fieldErrors?.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={descId}>Opis</Label>
        <Textarea
          id={descId}
          name="description"
          rows={3}
          defaultValue={initialDescription ?? ""}
          maxLength={280}
          error={fieldErrors?.description}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={pending}>
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </Button>
        {flash && <span className="text-xs text-success-text">{flash}</span>}
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
  const confirmId = useId();
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    deleteWorkspaceAction,
    null,
  );

  const fieldError = !state?.ok ? state?.fieldErrors?.confirmName : undefined;
  const formError = !state?.ok ? state?.error : undefined;

  if (!expanded) {
    return (
      <div className="flex max-w-[560px] flex-col gap-2.5">
        <p className="text-xs text-fg-2">
          Usunięcie przestrzeni jest <span className="font-medium text-foreground">nieodwracalne</span>.
          Wszystkie tablice, zadania, komentarze i załączniki zostaną oznaczone jako usunięte.
        </p>
        <Button type="button" variant="secondary" onClick={() => setExpanded(true)} className="w-fit text-danger-text">
          Usuń przestrzeń
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex max-w-[560px] flex-col gap-3 rounded-lg border border-danger bg-chip-red-bg p-4"
    >
      <input type="hidden" name="id" value={workspaceId} />
      <p className="text-xs">
        Aby potwierdzić, wpisz dokładną nazwę: <span className="font-mono font-medium">{workspaceName}</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={confirmId}>Potwierdzenie</Label>
        <Input
          id={confirmId}
          name="confirmName"
          required
          autoComplete="off"
          autoFocus
          className="font-mono"
          error={fieldError}
        />
      </div>
      {formError && (
        <p role="alert" className="text-xs text-danger-text">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" loading={pending} disabled={pending}>
          {pending ? "Usuwam…" : "Tak, usuń nieodwracalnie"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setExpanded(false)}>
          Anuluj
        </Button>
      </div>
    </form>
  );
}
