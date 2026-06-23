"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(app)/profile/password-actions";

export function ChangePasswordSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

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
      className="flex flex-col gap-6 border-t border-border pt-8"
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Bezpieczeństwo</span>
        <h2 className="font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em]">
          Zmień hasło
        </h2>
        <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
          Wymagamy aktualnego hasła — żeby ktoś z otwartą sesją nie podmienił Ci
          dostępu.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="eyebrow">Aktualne hasło</span>
        <div className="relative">
          <input
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={!!fieldErrors?.currentPassword}
            className="h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-[0.92rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? "Ukryj hasło" : "Pokaż hasło"}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
          >
            {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {fieldErrors?.currentPassword && (
          <span className="font-mono text-[0.68rem] text-destructive">
            {fieldErrors.currentPassword}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-2">
        <span className="eyebrow">Nowe hasło (min 8 znaków)</span>
        <div className="relative">
          <input
            name="newPassword"
            type={showNew ? "text" : "password"}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            aria-invalid={!!fieldErrors?.newPassword}
            className="h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-[0.92rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? "Ukryj hasło" : "Pokaż hasło"}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
          >
            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {fieldErrors?.newPassword && (
          <span className="font-mono text-[0.68rem] text-destructive">
            {fieldErrors.newPassword}
          </span>
        )}
      </label>

      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.88rem] text-destructive">
          {formError}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.88rem] text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-brand-gradient px-4 font-sans text-[0.92rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Zmienianie…" : "Zmień hasło"}
        </button>
      </div>
    </form>
  );
}
