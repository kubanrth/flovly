"use client";

// Dodanie użytkownika z poziomu /admin/users: e-mail + imię + hasło +
// opcjonalny super admin. Walidację i uprawnienia trzyma `createUserAction`.

import { startTransition, useState } from "react";
import { createUserAction } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconEye, IconEyeOff, IconPlus } from "@/components/ui/icons";
import { Input, InputGroup } from "@/components/ui/input";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (formData: FormData) => {
    setError(null);
    setPending(true);
    try {
      const res = await createUserAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setIsSuperAdmin(false);
    } catch (err) {
      console.error("Create user failed:", err);
      setError("Nie udało się utworzyć użytkownika.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <IconPlus width={14} height={14} />
        Dodaj użytkownika
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Dodaj użytkownika</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Bez wysyłki maila — konto jest aktywne od razu. Hasło przekaż inną drogą.
          </p>
        </DialogHeader>
        <form id="create-user-form" action={(fd) => startTransition(() => submit(fd))}>
          <DialogBody className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">E-mail *</span>
              <Input name="email" type="email" required autoFocus placeholder="user@example.com" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Imię *</span>
              <Input name="name" type="text" required minLength={2} maxLength={80} placeholder="Daniel" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Hasło * (min. 8 znaków)</span>
              <InputGroup
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={200}
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

            <div className="flex items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-2">
              <Checkbox
                checked={isSuperAdmin}
                onChange={() => setIsSuperAdmin((v) => !v)}
                ariaLabel="Super admin"
              />
              {/* Wartość leci do akcji ukrytym polem — checkbox jest sterowany. */}
              {isSuperAdmin && <input type="hidden" name="isSuperAdmin" value="true" />}
              <span className="text-sm">
                <span className="font-medium">Super admin</span>
                <span className="ml-2 text-muted-foreground">— pełny dostęp do /admin</span>
              </span>
            </div>

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
              {pending ? "Tworzenie…" : "Utwórz konto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
