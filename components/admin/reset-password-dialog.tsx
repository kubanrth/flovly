"use client";

// Reset hasła istniejącego konta z panelu admina. Super admin podaje nowe
// hasło wprost i przekazuje je użytkownikowi inną drogą; akcja wylogowuje
// aktywne sesje i kasuje 2FA.

import { startTransition, useState } from "react";
import { resetUserPasswordAction } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconEye, IconEyeOff, IconPasswords } from "@/components/ui/icons";
import { InputGroup } from "@/components/ui/input";

export function ResetPasswordDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (formData: FormData) => {
    setError(null);
    setPending(true);
    try {
      const res = await resetUserPasswordAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
    } catch (err) {
      console.error("Password reset failed:", err);
      setError("Nie udało się zresetować hasła.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" iconOnly aria-label={`Zmień hasło: ${email}`} title="Zmień hasło" />}
      >
        <IconPasswords width={14} height={14} />
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nowe hasło dla {email}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Reset wylogowuje wszystkie aktywne sesje i kasuje 2FA, jeśli było włączone.
          </p>
        </DialogHeader>
        <form action={(fd) => startTransition(() => submit(fd))}>
          <DialogBody className="flex flex-col gap-3">
            <input type="hidden" name="id" value={userId} />
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Nowe hasło * (min. 8 znaków)</span>
              <InputGroup
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={200}
                autoFocus
                placeholder="••••••••"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                    className="grid size-6 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground active:text-orange-800"
                  >
                    {showPassword ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
                  </button>
                }
              />
            </label>
            {error && (
              <p role="alert" className="rounded-md border border-border bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending} loading={pending}>
              {pending ? "Resetowanie…" : "Zmień hasło"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
