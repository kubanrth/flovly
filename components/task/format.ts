// Date/duration formatting shared by the task card (B2): mono stamps like
// "dziś 11:42", "wczoraj 16:05", "22 sie 2026, 09:14", "3h 20m".
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function dayLabel(d: Date, now = new Date()): "dziś" | "wczoraj" | null {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  return diff === 0 ? "dziś" : diff === 1 ? "wczoraj" : null;
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "dziś 11:42" | "wczoraj 16:05" | "22 sie 09:14" | "22 sie 2025 09:14"
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const rel = dayLabel(d);
  if (rel) return `${rel} ${hm(d)}`;
  const year = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${hm(d)}`;
}

// Footer stamps: "dziś, 12:03" | "22 sie 2026, 09:14"
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const rel = dayLabel(d);
  return rel ? `${rel}, ${hm(d)}` : `${formatDay(iso)}, ${hm(d)}`;
}

// Reminder: "29 sie, 09:00"
export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm(d)}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return s === 0 ? "0m" : `${s}s`;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}
