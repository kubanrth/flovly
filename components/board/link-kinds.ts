import type { BoardLinkKind } from "@/lib/generated/prisma/enums";

// Kolory marek Google dla chipów linków. To dane, nie warstwa stylu — nie da
// się ich wyrazić tokenami FLOVLY, bo to cudze barwy firmowe.
export const KIND_VISUAL: Record<
  BoardLinkKind,
  { label: string; color: string; bg: string; icon: string }
> = {
  DRIVE: { label: "Drive", color: "#1A73E8", bg: "#E8F0FE", icon: "▲" },
  SHEETS: { label: "Sheets", color: "#188038", bg: "#E6F4EA", icon: "▦" },
  DOCS: { label: "Docs", color: "#1967D2", bg: "#E8F0FE", icon: "▤" },
  SLIDES: { label: "Slides", color: "#F29900", bg: "#FEF7E0", icon: "▥" },
  OTHER: { label: "Link", color: "#475569", bg: "#F1F5F9", icon: "↗" },
};
