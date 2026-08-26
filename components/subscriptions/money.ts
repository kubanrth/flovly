// E5 Subskrypcje — czysta arytmetyka pieniędzy i roll-up cykli.
// Self-check: `npx tsx components/subscriptions/money.check.ts`

export type Cycle = "MONTHLY" | "YEARLY";

/** Górna granica z `patchSubscriptionAction` — trzymamy klienta w tych samych ryzach. */
const MAX_PLN = 10_000_000;

/**
 * „129,99" i „129.99" znaczą to samo (klient wkleja raz z faktury, raz z panelu
 * dostawcy). Spacje/NBSP jako separator tysięcy są wycinane.
 * Zwraca grosze albo `null` gdy wejście nie jest kwotą.
 */
export function parseAmountPln(input: string): number | null {
  // `\s` łapie też NBSP (U+00A0), którym Intl rozdziela tysiące.
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const zloty = Number(cleaned);
  if (!Number.isFinite(zloty) || zloty > MAX_PLN) return null;
  return Math.round(zloty * 100);
}

function groupThousands(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** „129,99 zł" — pełna kwota z groszami (komórka Kwota). */
export function formatPln(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${groupThousands(whole)},${frac} zł`;
}

/** „4 318 zł" — kafle KPI i stopka, bez groszy (jak makieta E5). */
export function formatPlnRounded(cents: number): string {
  return `${groupThousands(Math.round(cents / 100))} zł`;
}

/** Wartość do inputu w trakcie edycji: „129,99" (pusto dla zera). */
export function centsToInput(cents: number): string {
  if (cents === 0) return "";
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Suma miesięczna i prognoza roczna z mieszanych cykli:
 * roczna subskrypcja liczy się do „miesięcznie" jako 1/12, miesięczna do
 * „rocznie" jako ×12. Zaokrąglenie dopiero na sumie, nie per wiersz.
 */
export function rollUp(rows: readonly { amountCents: number; cycle: Cycle }[]): {
  monthlyCents: number;
  yearlyCents: number;
} {
  let monthly = 0;
  let yearly = 0;
  for (const r of rows) {
    if (r.cycle === "MONTHLY") {
      monthly += r.amountCents;
      yearly += r.amountCents * 12;
    } else {
      monthly += r.amountCents / 12;
      yearly += r.amountCents;
    }
  }
  return { monthlyCents: Math.round(monthly), yearlyCents: Math.round(yearly) };
}
