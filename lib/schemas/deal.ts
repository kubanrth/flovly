import { z } from "zod";

export const dealFieldsSchema = z.object({
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(200),
  valueAmount: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v || v.trim().length === 0) return null;
      // Accept "12 345,67" / "12,345.67" / "12345" — strip spaces and unify decimal.
      const normalized = v.replace(/\s+/g, "").replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  valueCurrency: z
    .string()
    .trim()
    .max(8)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : "PLN")),
  expectedCloseAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v || v.length === 0) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  stageId: z.string().trim().min(1, "Wybierz etap."),
  ownerId: z.string().trim().min(1).optional().or(z.literal("")),
  contactId: z.string().trim().min(1).optional().or(z.literal("")),
});

export const dealStageFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nazwa jest wymagana.").max(60),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Kolor musi być w formacie #RRGGBB."),
  closedKind: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v): "won" | "lost" | null => {
      if (v === "won" || v === "lost") return v;
      return null;
    }),
});

// Lazy seed defaults — called when /sales loads for the first time on a
// workspace that has zero DealStage rows. Mirrors how StatusColumn is created
// alongside Board.
export const DEFAULT_DEAL_STAGES = [
  { name: "Lead", colorHex: "#64748B", closedKind: null as null | "won" | "lost" },
  { name: "Kontakt", colorHex: "#3B82F6", closedKind: null as null | "won" | "lost" },
  { name: "Oferta", colorHex: "#F59E0B", closedKind: null as null | "won" | "lost" },
  { name: "Negocjacje", colorHex: "#8B5CF6", closedKind: null as null | "won" | "lost" },
  { name: "Wygrane", colorHex: "#10B981", closedKind: "won" as null | "won" | "lost" },
  { name: "Przegrane", colorHex: "#94A3B8", closedKind: "lost" as null | "won" | "lost" },
];
