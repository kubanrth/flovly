"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

// F12-K81 (v4 design): form z dużymi rounded input'ami (h-12, rounded-xl),
// brand focus ring, primary gradient submit, checkbox "pozostań zalogowany"
// + link "zapomniałem hasła". 100% funkcjonalności starego formu zachowane:
// loginAction, fieldErrors, pending state, redirectTo hidden, TOTP/recovery.
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/workspaces"} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        placeholder="adam@studio.pl"
        error={state?.fieldErrors?.email}
      />

      <Field
        label="Hasło"
        name="password"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        required
        placeholder="••••••••"
        error={state?.fieldErrors?.password}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            // 24×24px target ≥ WCAG 2.2 2.5.8 (Target Size Minimum)
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <Field
        label="Kod 2FA (jeśli włączone)"
        name="totp"
        type="text"
        autoComplete="one-time-code"
        placeholder="123456 lub kod zapasowy"
        // inputMode text (nie numeric) — żeby użytkownik mógł wpisać/wkleić
        // XXXX-XXXX-XXXX recovery code w tym samym polu.
        error={state?.fieldErrors?.totp}
      />

      {/* Row z "pozostań zalogowany" + "zapomniałem hasła" — wizualnie z v4 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="inline-flex cursor-pointer select-none items-center gap-2.5">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            // Native checkbox z brand color'em via accent-color. Min target 24px.
            className="h-[18px] w-[18px] cursor-pointer rounded-md border-border accent-[var(--accent-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <span className="text-[0.86rem] text-foreground">Pozostań zalogowany</span>
        </label>
        <a
          href="/secure-access-portal/forgot-password"
          className="text-[0.86rem] font-medium text-primary transition-colors hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Zapomniałem hasła
        </a>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        // Full-width primary gradient (140deg) z shadow-brand. h-12.
        className="group relative mt-1 inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-brand-gradient px-6 text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="relative z-10 font-sans text-[0.95rem] font-semibold tracking-wide">
          {pending ? "Loguję…" : "Zaloguj się"}
        </span>
      </button>
    </form>
  );
}

// Pojedyncze pole — wizualnie z referencji v4:
// - eyebrow label (small caps mono)
// - h-12 rounded-xl border, brand focus ring (focus-within)
// - opcjonalny trailing icon (np. pokaż/ukryj password)
function Field({
  label,
  name,
  type,
  autoComplete,
  required,
  placeholder,
  error,
  trailing,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div
        className={
          // focus-within przesuwa border + dokłada glow ring w kolorze brand
          "flex h-12 items-center gap-2 rounded-xl border bg-background/40 px-4 transition-[border-color,box-shadow] " +
          (error
            ? "border-destructive focus-within:border-destructive focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_18%,transparent)]"
            : "border-border focus-within:border-[var(--accent-brand)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent-brand)_18%,transparent)]")
        }
      >
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          aria-invalid={!!error}
          className="h-full w-full flex-1 bg-transparent text-[0.95rem] text-foreground outline-none placeholder:text-muted-foreground/55"
        />
        {trailing}
      </div>
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
