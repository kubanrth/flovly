"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  acceptInviteAction,
  type AcceptInviteState,
} from "./actions";

// F12-K81 (v4 design): form z dużymi rounded input'ami (h-12, rounded-xl),
// brand focus ring, primary "Akceptuj" gradient + "Odrzuć" ghost.
// Zachowane: acceptInviteAction, fieldErrors, pending, redirect fallback,
// pre-fill email (readonly), conditional "Imię i nazwisko" dla nowych userów.
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
  const [showPassword, setShowPassword] = useState(false);

  // Fallback: server zazwyczaj robi redirect na ok=true, ale jeśli response
  // prześliźnie się bez niego, robimy nawigację po stronie klienta, żeby
  // nie utknąć w pending UI.
  useEffect(() => {
    if (state?.ok) {
      router.replace(`/w/${workspaceId}`);
    }
  }, [state, router, workspaceId]);

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error : undefined;

  return (
    // Mobile v4: flex-1 + CTA stack mt-auto → przyciski wpadają w dolną
    // krawędź viewport'u (sticky-bottom feel). Desktop bez zmian.
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-1 flex-col gap-4 md:gap-5"
    >
      <input type="hidden" name="token" value={token} />

      {/* Email — readonly display, w wizualnym stylu pól input'owych v4.
          h-[52px] na mobile dla zgodności z innymi polami auth. */}
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Email</span>
        <div className="flex h-[52px] items-center rounded-xl border border-border bg-background/20 px-4 font-mono text-[0.88rem] text-muted-foreground md:h-12">
          {email}
        </div>
      </div>

      {!isExistingUser && (
        <FieldV4
          label="Imię i nazwisko"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="np. Anna Kowalska"
          autoFocus
          error={fieldErrors?.name}
        />
      )}

      <FieldV4
        label={isExistingUser ? "Hasło (istniejące konto)" : "Ustaw hasło"}
        name="password"
        type={showPassword ? "text" : "password"}
        required
        minLength={8}
        autoFocus={isExistingUser}
        autoComplete={isExistingUser ? "current-password" : "new-password"}
        placeholder="••••••••"
        helper={
          isExistingUser
            ? "Wpisz hasło od swojego istniejącego konta FLOVLY"
            : "Minimum 8 znaków"
        }
        error={fieldErrors?.password}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            // 24×24 min target ≥ WCAG 2.2 2.5.8
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive"
        >
          {formError}
        </p>
      )}

      {/* CTA stack: Akceptuj (primary gradient) + Odrzuć (ghost) — z v4.
          Mobile: mt-auto + h-[52px] (sticky-bottom + touch target). */}
      <div className="mt-auto flex flex-col gap-2.5 md:mt-1">
        <button
          type="submit"
          disabled={pending}
          className="group relative inline-flex h-[52px] w-full items-center justify-center overflow-hidden rounded-xl bg-brand-gradient px-6 text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 md:h-12"
        >
          <span className="relative z-10 font-sans text-[0.95rem] font-semibold tracking-wide">
            {pending ? "Dołączam…" : "Akceptuj zaproszenie"}
          </span>
        </button>
        <Link
          href="/"
          // "Odrzuć" — bez dedicated decline action, kierujemy usera poza flow.
          // Token zostaje aktywny do expiresAt, user może wrócić.
          className="inline-flex h-[52px] w-full items-center justify-center rounded-xl border border-border bg-background/40 px-6 font-sans text-[0.92rem] font-semibold text-foreground transition-colors hover:bg-background/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-12"
        >
          Odrzuć
        </Link>
      </div>
    </form>
  );
}

// V4 field — h-12 rounded-xl + brand focus ring + opcjonalny trailing/helper.
function FieldV4({
  label,
  name,
  type,
  required,
  maxLength,
  minLength,
  placeholder,
  autoComplete,
  autoFocus,
  helper,
  error,
  trailing,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  helper?: string;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div
        className={
          // Mobile: h-[52px] dla touch comfort. Desktop: h-12 jak w v4 desktop.
          "flex h-[52px] items-center gap-2 rounded-xl border bg-background/40 px-4 transition-[border-color,box-shadow] md:h-12 " +
          (error
            ? "border-destructive focus-within:border-destructive focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_18%,transparent)]"
            : "border-border focus-within:border-[var(--accent-brand)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent-brand)_18%,transparent)]")
        }
      >
        <input
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          // text-[16px] na mobile = brak iOS auto-zoom przy focusie.
          className="h-full w-full flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground/55 md:text-[0.95rem]"
        />
        {trailing}
      </div>
      {helper && !error && (
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {helper}
        </span>
      )}
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
