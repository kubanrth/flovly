import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Wejście · FLOVLY",
};

export default async function SecureAccessPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 45% at 85% 10%, color-mix(in oklch, var(--accent-brand) 14%, transparent) 0%, transparent 55%)," +
            "radial-gradient(40% 35% at 5% 95%, color-mix(in oklch, var(--accent-brand-2) 10%, transparent) 0%, transparent 55%)",
        }}
      />

      <header className="flex items-center justify-between px-8 pt-8 md:px-14 md:pt-10">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient text-white font-display text-[0.82rem] font-bold">
            F
          </span>
          <span className="font-display text-[1rem] font-semibold tracking-[-0.01em]">
            FLOVLY
          </span>
        </div>
        <span className="eyebrow hidden md:inline">secure access portal</span>
      </header>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="eyebrow">Witaj z powrotem</span>
          <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
            Zaloguj się,<br />
            <span className="text-brand-gradient">do roboty.</span>
          </h1>
          <p className="mt-3 max-w-[36ch] text-[0.95rem] leading-[1.6] text-muted-foreground">
            Wpisz swoje dane służbowe, żeby wejść do systemu zarządzania
            projektami.
          </p>
        </div>

        <LoginForm redirectTo={redirect} />

        <p className="mt-10 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          Problem z dostępem? Skontaktuj się z administratorem workspace’u.
        </p>
      </main>

      <footer className="flex items-center justify-between px-8 pb-8 md:px-14 md:pb-10">
        <span className="eyebrow">© {new Date().getFullYear()} · Wewnętrzny dostęp</span>
        <span className="eyebrow hidden md:inline">Not for public distribution</span>
      </footer>
    </div>
  );
}
