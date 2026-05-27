"use client";

import { useActionState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInviteAction,
  type AcceptInviteState,
} from "./actions";

export function AcceptInviteForm({
  token,
  email,
  isExistingUser,
  workspaceId,
}: {
  token: string;
  email: string;
  isExistingUser: boolean;
  workspaceId: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction,
    null,
  );

  // Fallback: server normally redirects on ok=true, but if a response
  // slips through without one, navigate client-side to avoid sitting in pending.
  useEffect(() => {
    if (state?.ok) {
      router.replace(`/w/${workspaceId}`);
    }
  }, [state, router, workspaceId]);

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error : undefined;

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Email</span>
        <div className="h-10 border-b border-border pb-1 font-mono text-[0.92rem] text-muted-foreground">
          {email}
        </div>
      </div>

      {!isExistingUser && (
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Imię i nazwisko</span>
          <input
            name="name"
            type="text"
            required
            maxLength={80}
            placeholder="np. Anna Kowalska"
            autoFocus
            aria-invalid={!!fieldErrors?.name}
            className="h-10 border-b border-border bg-transparent pb-1 text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
          />
          {fieldErrors?.name && (
            <span className="font-mono text-[0.68rem] text-destructive">
              {fieldErrors.name}
            </span>
          )}
        </label>
      )}

      <label className="flex flex-col gap-2">
        <span className="eyebrow">
          {isExistingUser ? "Hasło (istniejące konto)" : "Ustaw hasło"}
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus={isExistingUser}
          autoComplete={isExistingUser ? "current-password" : "new-password"}
          aria-invalid={!!fieldErrors?.password}
          className="h-10 border-b border-border bg-transparent pb-1 text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
        />
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isExistingUser
            ? "Wpisz hasło od swojego istniejącego konta FLOVLY"
            : "Minimum 8 znaków"}
        </span>
        {fieldErrors?.password && (
          <span className="font-mono text-[0.68rem] text-destructive">
            {fieldErrors.password}
          </span>
        )}
      </label>

      {formError && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-lg bg-brand-gradient px-6 font-sans text-[0.92rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {pending ? "Dołączam…" : "Dołącz do przestrzeni"}
      </button>
    </form>
  );
}
