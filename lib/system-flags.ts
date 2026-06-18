// Source of truth for system flags.
//
// SystemFlag (Prisma) is a single key/value/Json table — we keep the catalog
// here so the UI never lists "ghost" flags that aren't recognised by app code,
// and so server actions can whitelist writable keys (no arbitrary upserts).
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` — 452px panel z 5 toggles.

export const SYSTEM_FLAGS = {
  ai_ateron_enabled: {
    label: "Asystent AI Ateron",
    description: "Włącza chat-asystenta Ateron we wszystkich workspace'ach.",
    defaultValue: true,
    destructive: false,
  },
  public_share_links: {
    label: "Publiczne linki do tablic",
    description: "Pozwala udostępniać boardy linkiem bez logowania.",
    defaultValue: true,
    destructive: false,
  },
  whiteboard_beta: {
    label: "Whiteboard (beta)",
    description: "Eksperymentalny moduł Whiteboard z Yjs — może mieć regresje.",
    defaultValue: false,
    destructive: false,
  },
  import_csv_xls: {
    label: "Import z CSV/XLS",
    description: "Włącza import zadań z plików CSV i XLSX.",
    defaultValue: true,
    destructive: false,
  },
  kill_switch_writes: {
    label: "Kill switch — blokada zapisu",
    description:
      "Twardo blokuje wszystkie mutacje aplikacji (incident-response). Włączaj tylko świadomie.",
    defaultValue: false,
    destructive: true,
  },
} as const;

export type SystemFlagKey = keyof typeof SYSTEM_FLAGS;

export const SYSTEM_FLAG_KEYS = Object.keys(SYSTEM_FLAGS) as SystemFlagKey[];
