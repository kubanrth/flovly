"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import {
  beginTotpEnrollmentAction,
  completeTotpEnrollmentAction,
  disableTotpAction,
} from "@/app/(app)/profile/totp-actions";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Uwierzytelnianie dwuskładnikowe</span>
          <h2 className="font-display text-[1.15rem] font-semibold tracking-[-0.01em]">
            {enabled ? "2FA jest włączone" : "2FA wyłączone"}
          </h2>
          <p className="max-w-[50ch] text-[0.88rem] text-muted-foreground">
            {enabled
              ? "Przy logowaniu będzie potrzebny 6-cyfrowy kod z Twojej aplikacji (Google Authenticator, 1Password, Bitwarden itp.). Możesz użyć kodu zapasowego jeśli zgubisz telefon."
              : "Dodaj drugą warstwę — kod z aplikacji przy każdym logowaniu. Potrzebujesz aplikacji TOTP na telefonie."}
          </p>
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
          aria-hidden
        >
          {enabled ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
        </span>
      </div>

      {enabled ? <DisableFlow /> : <EnrollFlow />}
    </section>
  );
}

// ── Enrollment ──────────────────────────────────────────────────────
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
      // Render the QR via Google Charts-free approach: use the browser's
      // dynamic import of qrcode which stays under 20KB gzipped.
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

  const verify = () => {
    if (step.kind !== "setup") return;
    setError(null);
    startTransition(async () => {
      const res = await completeTotpEnrollmentAction({ token });
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
        <button
          type="button"
          onClick={begin}
          disabled={pending}
          className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {pending ? "Generuję…" : "Włącz 2FA"}
        </button>
      </div>
    );
  }

  if (step.kind === "setup") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Krok 1</span>
          <p className="text-[0.88rem]">
            Zeskanuj kod QR w aplikacji uwierzytelniającej lub wpisz sekret ręcznie.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          {step.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={step.qrDataUrl}
              alt="Kod QR do 2FA"
              width={220}
              height={220}
              className="shrink-0 rounded-md border border-border bg-white p-2"
            />
          ) : (
            <code className="max-w-full overflow-x-auto rounded-md border border-border bg-muted p-2 font-mono text-[0.72rem]">
              {step.otpauthUrl}
            </code>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="eyebrow">Sekret</span>
            <SecretDisplay secret={step.base32} />
            <p className="text-[0.78rem] text-muted-foreground">
              Po zeskanowaniu wpisz bieżący 6-cyfrowy kod:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={token}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D+/g, "").slice(0, 6);
                  setToken(next);
                  // Mobile UX v4: po wpisaniu 6 cyfr — auto-submit.
                  if (next.length === 6 && !pending) {
                    startTransition(async () => {
                      const res = await completeTotpEnrollmentAction({ token: next });
                      if (!res.ok) {
                        setError(res.error);
                        return;
                      }
                      setStep({ kind: "done", recoveryCodes: res.recoveryCodes });
                    });
                  }
                }}
                // Mobile v4 spec: natywna numeric keypad + one-time-code autofill
                // (iOS przyciąga kod z SMS / authenticator app autofill).
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123 456"
                aria-label="6-cyfrowy kod"
                // Mobile: h-[52px] + text-[22px] mono center (zgodnie z v4 mobile
                // 2FA cells: 52px tall, 22px font, monospace, center). Desktop
                // zostaje przy oryginalnej wadze (h-10), ale font już mono large.
                className="h-[52px] w-[180px] rounded-md border border-border bg-background px-3 text-center font-mono text-[22px] tracking-[0.25em] outline-none focus:border-primary md:h-10 md:w-[140px] md:text-[1.1rem] md:tracking-[0.2em]"
              />
              <button
                type="button"
                onClick={verify}
                disabled={pending || token.length !== 6}
                // Mobile: 52px tall touch target. Desktop: h-10 jak było.
                className="inline-flex h-[52px] items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] disabled:opacity-60 md:h-10 md:px-4"
              >
                {pending ? "Sprawdzam…" : "Potwierdź"}
              </button>
            </div>
            {error && <ErrorLine message={error} />}
          </div>
        </div>
      </div>
    );
  }

  // step.kind === "done"
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <span className="eyebrow text-primary">2FA włączone</span>
      <p className="text-[0.88rem]">
        <strong>Zapisz te kody w bezpiecznym miejscu.</strong> Każdy z nich
        zadziała jednorazowo jeśli zgubisz dostęp do aplikacji. Nie pokażemy
        ich ponownie.
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {step.recoveryCodes.map((c) => (
          <li
            key={c}
            className="rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-[0.88rem] tracking-[0.08em]"
          >
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(step.recoveryCodes.join("\n"))
            .catch(() => {});
        }}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Copy size={12} /> Skopiuj wszystkie
      </button>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border px-4 font-sans text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        Gotowe
      </button>
    </div>
  );
}

// ── Disable ─────────────────────────────────────────────────────────
function DisableFlow() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/10"
      >
        <ShieldOff size={12} /> Wyłącz 2FA
      </button>
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
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-[0.88rem]">
        Podaj obecne hasło i bieżący kod z aplikacji, żeby wyłączyć 2FA.
      </p>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Hasło</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          // Mobile: h-[52px] + text-[16px] (no iOS zoom). Desktop: h-9.
          className="h-[52px] rounded-md border border-border bg-background px-3 text-[16px] outline-none focus:border-primary md:h-9 md:text-[0.95rem]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Kod 2FA</span>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D+/g, "").slice(0, 6))}
          // Mobile v4: numeric keypad + one-time-code autofill.
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          // Mobile: 52px touch target + text-[16px] (no iOS zoom). Desktop: h-9.
          className="h-[52px] w-[180px] rounded-md border border-border bg-background px-3 font-mono text-[16px] tracking-[0.2em] outline-none focus:border-primary md:h-9 md:w-[140px] md:text-[0.95rem]"
        />
      </label>
      {error && <ErrorLine message={error} />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !password || token.length !== 6}
          className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 font-sans text-[0.85rem] font-semibold text-destructive-foreground transition-opacity disabled:opacity-60"
        >
          {pending ? "Wyłączam…" : "Wyłącz 2FA"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setPassword("");
            setToken("");
            setError(null);
          }}
          className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 font-sans text-[0.82rem] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function SecretDisplay({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded-md border border-border bg-muted px-2 py-1 font-mono text-[0.78rem] tracking-[0.1em]">
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
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span
          key={copied ? "check" : "copy"}
          className="inline-flex animate-in fade-in zoom-in-50 duration-200"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </span>
      </button>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-destructive">
      {message}
    </p>
  );
}
