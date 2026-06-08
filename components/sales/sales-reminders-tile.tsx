import Link from "next/link";
import { Bell, BellRing, Clock } from "lucide-react";

export interface SalesReminderRow {
  dealId: string;
  title: string;
  reminderAt: string; // ISO
  ownerName: string | null;
  contactLabel: string | null;
  stageName: string;
  stageColor: string;
  sent: boolean; // reminderSentAt is set
}

// Kafelek "Nadchodzące przypomnienia" nad pipeline'em w /sales. Pokazuje N
// kolejnych deal'i z reminderAt — wystarczająco scannable żeby user widział
// co jutro / w przyszłym tygodniu wymaga uwagi bez wchodzenia do każdego
// deal'a osobno. Mirror dla TodoItem / Task reminders w "Twoja lista".
//
// Klient: "Dodanie modułu 'przypomnienia' do 'Plan sprzedaży'". Reminder
// field na deal'u JUŻ był (Deal.reminderAt z F12-K66 + cron wysyła maile),
// ale brakowało dedykowanego widoku zbiorczego.
export function SalesRemindersTile({
  workspaceId,
  rows,
  showCount = 6,
}: {
  workspaceId: string;
  rows: SalesReminderRow[];
  showCount?: number;
}) {
  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card/60 px-4 py-5">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-muted-foreground/60" />
          <span className="eyebrow">Nadchodzące przypomnienia</span>
        </div>
        <p className="text-[0.88rem] text-muted-foreground">
          Brak ustawionych przypomnień. Wejdź w dowolny deal, ustaw datę w
          polu „Przypomnienie" i system wyśle mailem przed terminem.
        </p>
      </section>
    );
  }

  const visible = rows.slice(0, showCount);
  const overflow = Math.max(0, rows.length - visible.length);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 md:px-5 md:py-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing size={13} className="text-fuchsia-600 dark:text-fuchsia-400" />
          <span className="eyebrow">Nadchodzące przypomnienia</span>
        </div>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {rows.length} {pluralPl(rows.length, "przypomnienie", "przypomnienia", "przypomnień")}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {visible.map((r) => {
          const due = new Date(r.reminderAt);
          const past = due.getTime() < Date.now();
          return (
            <li key={r.dealId}>
              <Link
                href={`/w/${workspaceId}/sales/${r.dealId}`}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: r.stageColor }}
                />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[0.92rem] font-medium transition-colors group-hover:text-primary">
                    {r.title}
                  </span>
                  <span className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.stageName}
                    {r.contactLabel ? ` · ${r.contactLabel}` : ""}
                    {r.ownerName ? ` · ${r.ownerName}` : ""}
                  </span>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${
                    past
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : r.sent
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                  }`}
                >
                  <Clock size={9} />
                  {formatReminderDate(due)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {overflow > 0 && (
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70">
          + jeszcze {overflow} {pluralPl(overflow, "przypomnienie", "przypomnienia", "przypomnień")}
        </p>
      )}
    </section>
  );
}

function formatReminderDate(d: Date): string {
  const now = Date.now();
  const diff = d.getTime() - now;
  const ABS_MS_24H = 24 * 60 * 60 * 1000;
  if (Math.abs(diff) < ABS_MS_24H) {
    // dziś / za chwilę / N godzin
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 0 && Math.abs(diff) < 7 * ABS_MS_24H) {
    return `${Math.round(Math.abs(diff) / ABS_MS_24H)} d temu`;
  }
  if (diff > 0 && diff < 7 * ABS_MS_24H) {
    return `za ${Math.round(diff / ABS_MS_24H)} d`;
  }
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" });
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
