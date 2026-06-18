import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

// 403 — uprawnienia. Brand-tinted icon w 64×64 square + body + back CTA.
// Używane w server components po `assertCan` które zwraca PermissionDeniedError.
export function Forbidden({
  title = "Brak dostępu",
  description = "Nie masz uprawnień do tego widoku. Skontaktuj się z administratorem przestrzeni.",
  backHref = "/workspaces",
  backLabel = "Wróć do listy",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="relative mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.22),transparent_65%)] blur-3xl"
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-[19px] border border-amber-500/30 bg-amber-500/10">
        <Lock size={28} strokeWidth={1.75} className="text-amber-500" aria-hidden />
      </div>
      <div className="relative flex flex-col gap-2">
        <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
          403 · forbidden
        </h2>
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
          {title}
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
          {description}
        </p>
      </div>
      <Link
        href={backHref}
        className="relative inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 md:h-10 md:rounded-lg md:text-[0.9rem]"
      >
        <ArrowLeft size={14} /> {backLabel}
      </Link>
    </div>
  );
}
