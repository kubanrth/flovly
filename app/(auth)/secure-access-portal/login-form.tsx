"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff } from "@/components/ui/icons";
import { loginAction, type LoginState } from "./actions";

// F6 (redesign v5): pola i przycisk z `components/ui/*`, tokeny v5.
// Logika bez zmian — `loginAction` waliduje i loguje po stronie serwera,
// komunikat błędu zostaje celowo ogólny (nie zdradzamy czy e-mail istnieje).

// Odbicie serwerowego limitu (`lib/rate-limit.ts` → auth.login = 5/15 min).
// To TYLKO podpowiedź w UI — blokadę egzekwuje serwer, licznik tutaj niczego
// nie chroni i niczego nie otwiera.
const ATTEMPTS_HINT_AT = 6;

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Liczymy wysłania formularza (udane kończą się przekierowaniem, więc
  // licznik rośnie tylko dla prób, które wróciły z serwera).
  const rateLimited = attempts >= ATTEMPTS_HINT_AT;

  return (
    <form
      action={formAction}
      onSubmit={() => setAttempts((n) => n + 1)}
      className="mt-5 flex flex-col gap-3.5"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">E-mail</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          placeholder="ty@firma.pl"
          error={state?.fieldErrors?.email}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Hasło</Label>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pr-9"
            error={state?.fieldErrors?.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            // 24×24 = minimalny cel dotykowy (WCAG 2.2 · 2.5.8).
            className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-sm text-n-500 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            {showPassword ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-totp">Kod 2FA</Label>
        <Input
          id="login-totp"
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456 lub kod zapasowy"
          error={state?.fieldErrors?.totp}
        />
        <p className="text-2xs text-fg-3">Wypełnij tylko jeśli masz włączone dwuskładnikowe logowanie.</p>
      </div>

      {(state?.error || rateLimited) && (
        <p
          role="alert"
          data-ui="login-error"
          className="rounded-sm border border-danger/40 bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text"
        >
          {state?.error ?? "Logowanie nie powiodło się. Spróbuj ponownie."}
          {rateLimited && " Zbyt wiele prób logowania — limit to 5 prób na 15 minut, odczekaj chwilę."}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} disabled={pending} className="mt-1 w-full">
        {pending ? "Loguję…" : "Zaloguj się"}
      </Button>
    </form>
  );
}
