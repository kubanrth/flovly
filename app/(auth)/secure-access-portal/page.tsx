import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { FlovlySignature } from "@/components/brand/flovly-logo";

export const metadata: Metadata = {
  title: "Wejście · FLOVLY",
};

// F12-K81 (v4 design): pełen refactor do glass card centered na bg-aura.
// Layout 1:1 z `flovly v2/Flovly Auth & Workspaces.dc.html` (sekcja LOGIN).
// Header / footer usunięte — brand mark trzyma się wewnątrz karty.
export default async function SecureAccessPortalPage({
  searchParams,
}: {
  // Next 16: searchParams jest Promise<{}>, musi być await'owany.
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="relative isolate flex min-h-dvh items-stretch justify-center overflow-hidden bg-aura px-0 py-0 md:items-center md:px-6 md:py-12">
      {/* Dodatkowe radial blob'y nad bg-aura — wzmacniają hero feel z referencji.
          Pointer-events none, czysty dekor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent-brand) 35%, transparent), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 -z-10 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent-brand-2) 35%, transparent), transparent 65%)",
        }}
      />

      {/* Mobile: full-bleed (no card chrome, min-h-dvh, safe-area padding).
          Desktop (md+): centered glass card 420px. v4 spec B1 · Auth mobile. */}
      <main className="glass-surface relative flex w-full flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] max-md:min-h-dvh max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-none md:max-w-[420px] md:rounded-2xl md:p-10">
        {/* Brand mark + wordmark + tagline, jak na referencji v4 (logo nad heading'em) */}
        <div className="mb-8 flex flex-col items-center text-center">
          <FlovlySignature size="md" />
          <p className="mt-3 text-[0.82rem] text-muted-foreground">
            Workflow który płynie
          </p>
        </div>

        <div className="mb-7 flex flex-col items-start gap-2">
          <span className="eyebrow">Witaj z powrotem</span>
          <h1 className="font-display text-[2.1rem] font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
            Zaloguj się,
            <br />
            <span className="text-brand-gradient">do roboty.</span>
          </h1>
        </div>

        <LoginForm redirectTo={redirect} />

        <p className="mt-7 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          Problem z dostępem? Skontaktuj się z administratorem workspace’u.
        </p>
      </main>
    </div>
  );
}
