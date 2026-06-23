"use client";

import { startTransition, useState } from "react";
import { Eye, EyeOff, Key, X } from "lucide-react";
import { resetUserPasswordAction } from "@/app/(admin)/admin/actions";

// Dialog resetowania hasła istniejącego user'a (z poziomu
// admin panel). Super admin podaje nowe hasło bezpośrednio — przekaże
// user'owi inną drogą. Opcja dla "Daniel zapomniał hasła".
export function ResetPasswordDialog({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (formData: FormData) => {
    setError(null);
    setPending(true);
    const res = await resetUserPasswordAction(formData);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Zmień hasło"
        title="Zmień hasło"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Key size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="relative flex w-[min(420px,100%)] flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(10,10,40,0.35)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </button>

            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Reset hasła</span>
              <h2 className="font-display text-[1.3rem] font-bold leading-tight tracking-[-0.02em]">
                Nowe hasło dla <span className="text-brand-gradient">{email}</span>
              </h2>
              <p className="text-[0.82rem] text-muted-foreground">
                Reset wyloguje wszystkie aktywne sesje user&apos;a + skasuje 2FA (jeśli było).
              </p>
            </div>

            <form
              action={(fd) => startTransition(() => submit(fd))}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={userId} />

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Nowe hasło * (min 8 znaków)
                </span>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={200}
                    autoFocus
                    placeholder="••••••••"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 pr-9 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </label>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.82rem] text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Resetowanie…" : "Zmień hasło"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
