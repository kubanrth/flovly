"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff } from "@/components/ui/icons";
import { acceptInviteAction, type AcceptInviteState } from "./actions";

// F6 (redesign v5): pola i przyciski z `components/ui/*`.
// Logika bez zmian — token, hasło i zakres sprawdza `acceptInviteAction`.

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

  // Fallback: serwer zwykle przekierowuje po ok=true, ale gdyby odpowiedź
  // przeszła bez redirectu, nawigujemy po stronie klienta.
  useEffect(() => {
    if (state?.ok) router.replace(`/w/${workspaceId}`);
  }, [state, router, workspaceId]);

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error : undefined;

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="mt-4 flex flex-col gap-3.5"
    >
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">E-mail</Label>
        <Input
          id="invite-email"
          value={email}
          readOnly
          className="bg-canvas font-mono text-muted-foreground"
        />
      </div>

      {!isExistingUser && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-name">Imię i nazwisko</Label>
          <Input
            id="invite-name"
            name="name"
            type="text"
            required
            maxLength={80}
            autoFocus
            placeholder="np. Anna Kowalska"
            error={fieldErrors?.name}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-password">
          {isExistingUser ? "Hasło (istniejące konto)" : "Ustaw hasło"}
        </Label>
        <div className="relative">
          <Input
            id="invite-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoFocus={isExistingUser}
            autoComplete={isExistingUser ? "current-password" : "new-password"}
            placeholder="••••••••"
            className="pr-9"
            error={fieldErrors?.password}
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
        {!fieldErrors?.password && (
          <p className="text-2xs text-fg-3">
            {isExistingUser ? "Hasło od Twojego istniejącego konta." : "Minimum 8 znaków."}
          </p>
        )}
      </div>

      {formError && (
        <p
          role="alert"
          data-ui="invite-error"
          className="rounded-sm border border-danger/40 bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text"
        >
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} disabled={pending} className="mt-1 w-full">
        {pending ? "Dołączam…" : "Akceptuj zaproszenie"}
      </Button>
    </form>
  );
}
