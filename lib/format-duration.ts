// PL human-readable duration formatter. Round down do najbliższej
// jednostki — NIE pokazuje "0 dni 2 godz", tylko "2 godz".

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function plMinutes(n: number): string {
  if (n === 1) return "minuta";
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return "minut";
  if (last >= 2 && last <= 4) return "minuty";
  return "minut";
}

function plHours(n: number): string {
  if (n === 1) return "godz";
  return "godz";
}

function plDays(n: number): string {
  if (n === 1) return "dzień";
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return "dni";
  if (last >= 2 && last <= 4) return "dni";
  return "dni";
}

export function formatDuration(fromIso: string | Date, toIso: string | Date): string {
  const from = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  const to = typeof toIso === "string" ? new Date(toIso) : toIso;
  const ms = Math.max(0, to.getTime() - from.getTime());

  if (ms < MIN) return "<1 min";
  if (ms < HOUR) {
    const mins = Math.floor(ms / MIN);
    return `${mins} ${plMinutes(mins)}`;
  }
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const mins = Math.floor((ms % HOUR) / MIN);
    return mins > 0
      ? `${hours} ${plHours(hours)} ${mins} min`
      : `${hours} ${plHours(hours)}`;
  }
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  return hours > 0
    ? `${days} ${plDays(days)} ${hours} ${plHours(hours)}`
    : `${days} ${plDays(days)}`;
}
