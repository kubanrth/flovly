// Preset groupings dla widoku Tabela — semantyczne buckety czasowe
// + tag-alphabetical. Raw ISO timestamp dawałby 1 bucket per task.
// Preset id używa prefixu `preset:` — bucketing path w board-table.tsx
// łapie po prefixie, persistuje się w BoardView.configJson.

export type GroupPresetKind = "date-past" | "date-schedule" | "tags-alpha";

export interface GroupPresetDef {
  id: string;
  label: string;
  kind: GroupPresetKind;
}

export const GROUP_PRESETS: readonly GroupPresetDef[] = [
  { id: "preset:createdAt", label: "Data dodania", kind: "date-past" },
  { id: "preset:startAt", label: "Data startu", kind: "date-schedule" },
  { id: "preset:stopAt", label: "Data zakończenia", kind: "date-schedule" },
  { id: "preset:tagsAlpha", label: "Tagi (A→Z)", kind: "tags-alpha" },
] as const;

export interface BucketDescriptor {
  key: string;
  label: string;
  color?: string;
  order: number;
}

const NO_DATE_BUCKET: BucketDescriptor = {
  key: "_no_date",
  label: "Bez daty",
  order: 99,
};

// Lokalny TZ — "Dzisiaj" intuicyjny dla użytkownika, nie zależny od UTC.
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// UE-style week: niedziela = ostatni dzień, sun→mon = -6.
function startOfThisWeek(): Date {
  const today = startOfToday();
  const dow = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = dow === 0 ? 6 : dow - 1;
  return addDays(today, -diff);
}

function startOfNextWeek(): Date {
  return addDays(startOfThisWeek(), 7);
}

function startOfThisMonth(): Date {
  const today = startOfToday();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

// Past-only buckets dla createdAt: Dzisiaj | Wczoraj | Ten tydzień |
// Ten miesiąc | Starsze | Bez daty.
export function bucketDatePast(iso: string | null): BucketDescriptor {
  if (!iso) return NO_DATE_BUCKET;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_DATE_BUCKET;

  const today0 = startOfToday();
  const tomorrow0 = addDays(today0, 1);
  const yesterday0 = addDays(today0, -1);
  const week0 = startOfThisWeek();
  const month0 = startOfThisMonth();

  if (d >= today0 && d < tomorrow0) {
    return { key: "_today", label: "Dzisiaj", order: 0 };
  }
  if (d >= yesterday0 && d < today0) {
    return { key: "_yesterday", label: "Wczoraj", order: 1 };
  }
  if (d >= week0 && d < yesterday0) {
    return { key: "_this_week", label: "Ten tydzień", order: 2 };
  }
  if (d >= month0 && d < week0) {
    return { key: "_this_month", label: "Ten miesiąc", order: 3 };
  }
  return { key: "_older", label: "Starsze", order: 4 };
}

// Schedule buckets dla startAt/stopAt: Spóźnione | Dzisiaj | Jutro |
// Ten tydzień | Później | Bez daty.
export function bucketDateSchedule(iso: string | null): BucketDescriptor {
  if (!iso) return NO_DATE_BUCKET;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_DATE_BUCKET;

  const today0 = startOfToday();
  const tomorrow0 = addDays(today0, 1);
  const dayAfterTomorrow0 = addDays(today0, 2);
  const nextWeek0 = startOfNextWeek();

  if (d < today0) {
    return { key: "_overdue", label: "Spóźnione", order: 0 };
  }
  if (d >= today0 && d < tomorrow0) {
    return { key: "_today", label: "Dzisiaj", order: 1 };
  }
  if (d >= tomorrow0 && d < dayAfterTomorrow0) {
    return { key: "_tomorrow", label: "Jutro", order: 2 };
  }
  if (d >= dayAfterTomorrow0 && d < nextWeek0) {
    return { key: "_this_week", label: "Ten tydzień", order: 3 };
  }
  return { key: "_later", label: "Później", order: 4 };
}

// Pierwszy tag alfabetycznie. Order = code-point lowercased name —
// sortuje buckety A→Z bez external sort key map.
export function firstTagBucket(
  tags: { name: string; colorHex: string }[],
): BucketDescriptor {
  if (tags.length === 0) {
    return { key: "_no_tag", label: "— bez tagu —", order: Number.MAX_SAFE_INTEGER };
  }
  const sorted = [...tags].sort((a, b) =>
    a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
  );
  const first = sorted[0];
  const lower = first.name.toLocaleLowerCase("pl");
  const order = (lower.charCodeAt(0) ?? 0) * 1024 + (lower.charCodeAt(1) ?? 0);
  return { key: `tag:${first.name}`, label: first.name, color: first.colorHex, order };
}

export function bucketForPreset(
  presetId: string,
  task: {
    createdAt: string;
    startAt: string | null;
    stopAt: string | null;
    tags: { name: string; colorHex: string }[];
  },
): BucketDescriptor {
  switch (presetId) {
    case "preset:createdAt":
      return bucketDatePast(task.createdAt);
    case "preset:startAt":
      return bucketDateSchedule(task.startAt);
    case "preset:stopAt":
      return bucketDateSchedule(task.stopAt);
    case "preset:tagsAlpha":
      return firstTagBucket(task.tags);
    default:
      return NO_DATE_BUCKET;
  }
}
