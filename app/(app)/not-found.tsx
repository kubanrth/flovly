import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

// Catch-all 404 dla obszaru aplikacji (app). Łapie wszystkie notFound()
// rzucone z server components — task'i, kontakty, deale, board'y, view'y
// itd. Klient: "w różnych losowych momentach pojawia się 404 i trzeba
// przeładować stronę". To było natywne Next.js 404. Teraz friendly page
// z back-link'iem zamiast wymaganego F5.
export default function AppNotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-16 text-center md:py-24">
      <Compass size={48} className="text-muted-foreground/40" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.9rem]">
          Tej strony <span className="text-brand-gradient">już nie ma</span>
        </h1>
        <p className="text-[0.95rem] leading-[1.55] text-muted-foreground">
          Link mógł się zestarzeć albo obiekt został usunięty. Zacznij od
          przeglądu workspace'ów i kliknij ten, który Cię interesuje.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/workspaces"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90"
        >
          <ArrowLeft size={14} /> Wszystkie przestrzenie
        </Link>
        <Link
          href="/profile"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 font-sans text-[0.88rem] font-medium text-foreground transition-colors hover:bg-accent"
        >
          Twój profil
        </Link>
      </div>
    </main>
  );
}
