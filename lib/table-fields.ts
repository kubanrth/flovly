// Airtable-style field type system for the Tabela view.
// All cell values stored as text in TaskCustomValue.valueText.
// Per-type encoding helpers at the bottom (encode/decode/parse).

import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  Hash,
  Link as LinkIcon,
  ListChecks,
  Mail,
  Paperclip,
  Phone,
  Star,
  Tag,
  Type as TypeIcon,
  User,
  Clock,
  Hash as HashIcon,
} from "lucide-react";

export type FieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "CHECKBOX"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "URL"
  | "EMAIL"
  | "PHONE"
  | "RATING"
  | "USER"
  | "ATTACHMENT"
  | "CREATED_TIME"
  | "LAST_MODIFIED_TIME"
  | "AUTO_NUMBER";

export const ALL_FIELD_TYPES: FieldType[] = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
  "RATING",
  "USER",
  "ATTACHMENT",
  "CREATED_TIME",
  "LAST_MODIFIED_TIME",
  "AUTO_NUMBER",
];

// Computed types — value is derived from the row, no edit cell.
export const COMPUTED_FIELD_TYPES = new Set<FieldType>([
  "CREATED_TIME",
  "LAST_MODIFIED_TIME",
  "AUTO_NUMBER",
]);

export interface SelectOption {
  // User-visible label AND stable key — renaming would orphan cells, so
  // we update the option in place while cells keep referencing the string.
  value: string;
  color: string;
}

export interface FieldOptions {
  // SINGLE_SELECT / MULTI_SELECT
  selectOptions?: SelectOption[];
  // NUMBER
  numberFormat?: "integer" | "decimal" | "currency" | "percent";
  numberPrecision?: number;
  numberCurrency?: string; // e.g. "PLN", "USD"
  // DATE
  dateIncludeTime?: boolean;
  // RATING
  ratingMax?: number;
  ratingIcon?: "star" | "heart" | "thumbs";
}

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  description: string;
  icon: typeof TypeIcon;
  computed?: boolean;
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  TEXT: {
    type: "TEXT",
    label: "Tekst",
    description: "Krótki tekst w jednej linii",
    icon: TypeIcon,
  },
  LONG_TEXT: {
    type: "LONG_TEXT",
    label: "Długi tekst",
    description: "Wieloliniowy obszar tekstowy",
    icon: AlignLeft,
  },
  NUMBER: {
    type: "NUMBER",
    label: "Liczba",
    description: "Liczba całkowita, dziesiętna, waluta lub procent",
    icon: Hash,
  },
  DATE: {
    type: "DATE",
    label: "Data",
    description: "Data, opcjonalnie z godziną",
    icon: CalendarDays,
  },
  CHECKBOX: {
    type: "CHECKBOX",
    label: "Checkbox",
    description: "Pojedynczy checkbox tak/nie",
    icon: CheckSquare,
  },
  SINGLE_SELECT: {
    type: "SINGLE_SELECT",
    label: "Pojedynczy wybór",
    description: "Lista kolorowych etykiet — można wybrać jedną",
    icon: Tag,
  },
  MULTI_SELECT: {
    type: "MULTI_SELECT",
    label: "Wielokrotny wybór",
    description: "Lista kolorowych etykiet — można wybrać kilka",
    icon: ListChecks,
  },
  URL: {
    type: "URL",
    label: "URL",
    description: "Link do strony internetowej",
    icon: LinkIcon,
  },
  EMAIL: {
    type: "EMAIL",
    label: "Email",
    description: "Adres email z mailto: na klik",
    icon: Mail,
  },
  PHONE: {
    type: "PHONE",
    label: "Telefon",
    description: "Numer telefonu z tel: na klik",
    icon: Phone,
  },
  RATING: {
    type: "RATING",
    label: "Ocena",
    description: "Skala 1-5 (gwiazdki, serca, kciuki)",
    icon: Star,
  },
  USER: {
    type: "USER",
    label: "Osoba",
    description: "Wybór członka workspace'u",
    icon: User,
  },
  ATTACHMENT: {
    type: "ATTACHMENT",
    label: "Załącznik",
    description: "Pliki linkowane do wiersza",
    icon: Paperclip,
  },
  CREATED_TIME: {
    type: "CREATED_TIME",
    label: "Data utworzenia",
    description: "Automatyczna — kiedy zadanie zostało utworzone",
    icon: Clock,
    computed: true,
  },
  LAST_MODIFIED_TIME: {
    type: "LAST_MODIFIED_TIME",
    label: "Ostatnia modyfikacja",
    description: "Automatyczna — kiedy zadanie zostało zmienione",
    icon: Clock,
    computed: true,
  },
  AUTO_NUMBER: {
    type: "AUTO_NUMBER",
    label: "Auto-numer",
    description: "Sekwencyjny numer rzędu (1, 2, 3, …)",
    icon: HashIcon,
    computed: true,
  },
};

export { SELECT_PALETTE } from "@/lib/colors";

// Decode stored string → typed JS. Tolerant; callers treat null as blank.
export function decodeCellValue(
  type: FieldType,
  raw: string | null | undefined,
): unknown {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (type) {
    case "NUMBER": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "CHECKBOX":
      return raw === "true" || raw === "1";
    case "MULTI_SELECT": {
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
      } catch {
        return [];
      }
    }
    case "RATING": {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    case "DATE":
      return raw; // ISO string
    case "ATTACHMENT": {
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    default:
      return raw;
  }
}

// Encode JS value → string for storage. Empty string = clear cell.
export function encodeCellValue(type: FieldType, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "NUMBER":
    case "RATING":
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      if (typeof value === "string" && value.trim() !== "") return value.trim();
      return "";
    case "CHECKBOX":
      return value ? "true" : "";
    case "MULTI_SELECT":
    case "ATTACHMENT":
      return Array.isArray(value) && value.length > 0 ? JSON.stringify(value) : "";
    default:
      return typeof value === "string" ? value : String(value ?? "");
  }
}

// Format typed value for display (read-only cells, exports, group headers).
export function formatCellValue(
  type: FieldType,
  value: unknown,
  options?: FieldOptions | null,
): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "NUMBER": {
      if (typeof value !== "number") return String(value);
      const fmt = options?.numberFormat ?? "decimal";
      const precision = options?.numberPrecision ?? (fmt === "integer" ? 0 : 2);
      if (fmt === "currency") {
        return new Intl.NumberFormat("pl-PL", {
          style: "currency",
          currency: options?.numberCurrency ?? "PLN",
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
      }
      if (fmt === "percent") {
        return new Intl.NumberFormat("pl-PL", {
          style: "percent",
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
      }
      if (fmt === "integer") {
        return new Intl.NumberFormat("pl-PL").format(Math.round(value));
      }
      return new Intl.NumberFormat("pl-PL", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value);
    }
    case "DATE": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return "";
      return options?.dateIncludeTime
        ? d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" })
        : d.toLocaleDateString("pl-PL", { dateStyle: "medium" });
    }
    case "CHECKBOX":
      return value ? "✓" : "";
    case "MULTI_SELECT":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}

export function parseFieldOptions(raw: unknown): FieldOptions {
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldOptions;
}
