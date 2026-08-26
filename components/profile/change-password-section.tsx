"use client";

import { useActionState, useId, useRef, useState, startTransition } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/app/(app)/profile/password-actions";
import { Button } from "@/components/ui/button";
import { IconEye, IconEyeOff } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Ukryj hasło" : "Pokaż hasło"}
      className="absolute top-0.5 right-1 grid size-7 place-items-center rounded-sm text-n-500 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
    >
      {shown ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
    </button>
  );
}

export function ChangePasswordSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const currentId = useId();
  const newId = useId();

  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    async (prev, fd) => {
      const next = await changePasswordAction(prev, fd);
      if (next?.ok) formRef.current?.reset();
      return next;
    },
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error : undefined;
  const success = state?.ok ? state.message : null;

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-md font-semibold">Zmień hasło</h3>
        <p className="text-xs text-fg-2">
          Wymagamy aktualnego hasła — żeby ktoś z otwartą sesją nie podmienił Ci dostępu.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={currentId}>Aktualne hasło</Label>
        <div className="relative">
          <Input
            id={currentId}
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            required
            autoComplete="current-password"
            error={fieldErrors?.currentPassword}
            className="pr-9"
          />
          <RevealButton shown={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={newId}>Nowe hasło (min. 8 znaków)</Label>
        <div className="relative">
          <Input
            id={newId}
            name="newPassword"
            type={showNew ? "text" : "password"}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            error={fieldErrors?.newPassword}
            className="pr-9"
          />
          <RevealButton shown={showNew} onToggle={() => setShowNew((v) => !v)} />
        </div>
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-danger bg-chip-red-bg px-3 py-2 text-xs text-danger-text">
          {formError}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-success bg-chip-green-bg px-3 py-2 text-xs text-success-text">
          {success}
        </p>
      )}

      <Button type="submit" loading={pending} disabled={pending} className="w-fit">
        {pending ? "Zmienianie…" : "Zmień hasło"}
      </Button>
    </form>
  );
}
