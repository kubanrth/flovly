import Link from "next/link";
import { ArrowLeft, Ghost } from "lucide-react";

// Direct task page not-found — user trafił na link do task'a którego już
// nie ma (usunięty / inny workspace). Zamiast generic Next.js 404 (klient:
// "trzeba przeładować stronę"), pokazujemy friendly fallback z back-link'iem.
//
// Note: server-side workspaceId nie jest dostępny w not-found component'cie
// — Next.js wywala route segment params w error/not-found boundaries.
// Pokazujemy więc generic link do /workspaces, user wybierze sam dokąd
// wrócić.
export default function TaskNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-16 text-center md:py-24">
      <Ghost size={48} className="text-muted-foreground/40" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[1.4rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.7rem]">
          Tego zadania już <span className="text-brand-gradient">nie ma</span>
        </h1>
        <p className="text-[0.95rem] leading-[1.55] text-muted-foreground">
          Mogło zostać usunięte, przeniesione do innej przestrzeni, albo masz
          stary link. Wracaj na listę i znajdź odpowiednie.
        </p>
      </div>
      <Link
        href="/workspaces"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90"
      >
        <ArrowLeft size={14} /> Wszystkie przestrzenie
      </Link>
    </div>
  );
}
