"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  beginTotpEnrollmentAction,
  completeTotpEnrollmentAction,
  disableTotpAction,
} from "@/app/(app)/profile/totp-actions";
import { Button } from "@/components/ui/button";
import { IconCheck, IconCopy, IconShield, IconShieldCheck } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sekret TOTP i kody zapasowe żyją wyłącznie w stanie klienta na czas
// rejestracji — nie trafiają do SSR i nie są przechowywane po odświeżeniu.

const CODE_INPUT = "h-11 w-[180px] text-center font-mono text-md tracking-[0.25em] md:h-8 md:w-[140px] md:text-sm";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-md font-semibold">
            {enabled ? "2FA jest włączone" : "2FA wyłączone"}
          </h3>
          <p className="text-xs text-fg-2">
            {enabled
              ? "Przy logowaniu potrzebny będzie 6-cyfrowy kod z aplikacji (Google Authenticator, 1Password, Bitwarden). Kod zapasowy zadziała, gdy zgubisz telefon."
              : "Dodaj drugą warstwę — kod z aplikacji przy każdym logowaniu. Potrzebujesz aplikacji TOTP na telefonie."}
          </p>
        </div>
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-full ${enabled ? "bg-chip-green-bg text-success-text" : "bg-n-100 text-fg-3"}`}
        >
          {enabled ? <IconShieldCheck width={15} height={15} /> : <IconShield width={15} height={15} />}
        </span>
      </div>

      {enabled ? <DisableFlow /> : <EnrollFlow />}
    </section>
  );
}

// ── Rejestracja ─────────────────────────────────────────────────────
type EnrollStep =
  | { kind: "idle" }
  | { kind: "setup"; base32: string; otpauthUrl: string; qrDataUrl: string | null }
  | { kind: "done"; recoveryCodes: string[] };

function EnrollFlow() {
  const router = useRouter();
  const [step, setStep] = useState<EnrollStep>({ kind: "idle" });
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const begin = () => {
    setError(null);
    startTransition(async () => {
      const res = await beginTotpEnrollmentAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      let qrDataUrl: string | null = null;
      try {
        const qrcode = await import("qrcode");
        qrDataUrl = await qrcode.toDataURL(res.otpauthUrl, { margin: 1, width: 220 });
      } catch {
        /* fall back to the plain URL below */
      }
      setStep({ kind: "setup", base32: res.base32, otpauthUrl: res.otpauthUrl, qrDataUrl });
    });
  };

  const complete = (value: string) => {
    setError(null);
    startTransition(async () => {
      const res = await completeTotpEnrollmentAction({ token: value });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep({ kind: "done", recoveryCodes: res.recoveryCodes });
    });
  };

  if (step.kind === "idle") {
    return (
      <div className="flex flex-col gap-2">
        {error && <ErrorLine message={error} />}
        <Button type="button" onClick={begin} loading={pending} disabled={pending} className="w-fit">
          {pending ? "Generuję…" : "Włącz 2FA"}
        </Button>
      </div>
    );
  }

  if (step.kind === "setup") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-canvas p-3.5">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Krok 1</span>
          <p className="text-xs">Zeskanuj kod QR w aplikacji uwierzytelniającej lub wpisz sekret ręcznie.</p>
        </div>
        <div className="flex flex-wrap items-start gap-3.5">
          {step.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={step.qrDataUrl}
              alt="Kod QR do 2FA"
              width={220}
              height={220}
              className="shrink-0 rounded-md border border-border bg-card p-2"
            />
          ) : (
            <code className="max-w-full overflow-x-auto rounded-sm border border-border bg-n-100 p-2 font-mono text-2xs">
              {step.otpauthUrl}
            </code>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="eyebrow">Sekret</span>
            <SecretDisplay secret={step.base32} />
            <p className="text-2xs text-fg-2">Po zeskanowaniu wpisz bieżący 6-cyfrowy kod:</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={token}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D+/g, "").slice(0, 6);
                  setToken(next);
                  // Po wpisaniu 6 cyfr — auto-submit (UX mobilny).
                  if (next.length === 6 && !pending) complete(next);
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                aria-label="6-cyfrowy kod"
                className={CODE_INPUT}
              />
              <Button
                type="button"
                onClick={() => complete(token)}
                loading={pending}
                disabled={pending || token.length !== 6}
                className="h-11 md:h-8"
              >
                {pending ? "Sprawdzam…" : "Potwierdź"}
              </Button>
            </div>
            {error && <ErrorLine message={error} />}
          </div>
        </div>
      </div>
    );
  }

  // step.kind === "done"
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-success bg-chip-green-bg p-3.5">
      <span className="eyebrow text-success-text">2FA włączone</span>
      <p className="text-xs">
        <strong>Zapisz te kody w bezpiecznym miejscu.</strong> Każdy zadziała jednorazowo, gdy
        stracisz dostęp do aplikacji. Nie pokażemy ich ponownie.
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {step.recoveryCodes.map((c) => (
          <li key={c} className="rounded-sm border border-border bg-card px-2.5 py-1.5 text-center font-mono text-xs tracking-[0.08em]">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(step.recoveryCodes.join("\n")).catch(() => {});
          }}
        >
          <IconCopy width={12} height={12} /> Skopiuj wszystkie
        </Button>
        <Button type="button" size="sm" onClick={() => router.refresh()}>
          Gotowe
        </Button>
      </div>
    </div>
  );
}

// ── Wyłączenie ──────────────────────────────────────────────────────
function DisableFlow() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
        className="w-fit text-danger-text"
      >
        <IconShield width={12} height={12} /> Wyłącz 2FA
      </Button>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await disableTotpAction({ password, token });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPassword("");
      setToken("");
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-danger bg-chip-red-bg p-3.5">
      <p className="text-xs">Podaj obecne hasło i bieżący kod z aplikacji, żeby wyłączyć 2FA.</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totp-off-password">Hasło</Label>
        <Input
          id="totp-off-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="h-11 md:h-8"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totp-off-token">Kod 2FA</Label>
        <Input
          id="totp-off-token"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D+/g, "").slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          className={CODE_INPUT}
        />
      </div>
      {error && <ErrorLine message={error} />}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="danger"
          onClick={submit}
          loading={pending}
          disabled={pending || !password || token.length !== 6}
        >
          {pending ? "Wyłączam…" : "Wyłącz 2FA"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setConfirming(false);
            setPassword("");
            setToken("");
            setError(null);
          }}
        >
          Anuluj
        </Button>
      </div>
    </div>
  );
}

function SecretDisplay({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded-sm border border-border bg-n-100 px-2 py-1 font-mono text-2xs tracking-[0.1em]">
        {secret}
      </code>
      <button
        type="button"
        aria-label="Skopiuj sekret"
        title="Skopiuj sekret"
        onClick={() => {
          navigator.clipboard
            ?.writeText(secret)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
      >
        {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
      </button>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-danger-text">
      {message}
    </p>
  );
}
