// E8 „Creative Board" — mapowanie statusów briefu na trzy segmenty makiety.
// Głosowanie jest pominięte (OMITTED.md), więc „Najpopularniejsze" to pomysły
// najbliżej wdrożenia: najpierw te w recenzji, potem szkice.

import type { ChipHue } from "@/components/ui/chip";

export type BriefStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
export type BriefSegment = "top" | "new" | "done";

export const BRIEF_SEGMENTS: { value: BriefSegment; label: string }[] = [
  { value: "top", label: "Najpopularniejsze" },
  { value: "new", label: "Najnowsze" },
  { value: "done", label: "Zrealizowane" },
];

export const STATUS_LABEL: Record<BriefStatus, string> = {
  DRAFT: "Szkic",
  IN_REVIEW: "W recenzji",
  APPROVED: "Zatwierdzony",
  ARCHIVED: "Zarchiwizowany",
};

export const STATUS_HUE: Record<BriefStatus, ChipHue> = {
  DRAFT: "gray",
  IN_REVIEW: "yellow",
  APPROVED: "green",
  ARCHIVED: "brown",
};

/** Zrealizowane = zatwierdzone lub zarchiwizowane; reszta to pomysły otwarte. */
export function isRealised(status: BriefStatus): boolean {
  return status === "APPROVED" || status === "ARCHIVED";
}

export interface BriefLite {
  id: string;
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
}

// „Bliskość wdrożenia" — w recenzji przed szkicem, potem najświeższa zmiana.
const OPEN_RANK: Record<BriefStatus, number> = { IN_REVIEW: 0, DRAFT: 1, APPROVED: 2, ARCHIVED: 3 };

export function selectBriefs<T extends BriefLite>(briefs: T[], segment: BriefSegment): T[] {
  if (segment === "done") {
    return briefs
      .filter((b) => isRealised(b.status))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  const open = briefs.filter((b) => !isRealised(b.status));
  if (segment === "new") {
    return open.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  return open.sort(
    (a, b) => OPEN_RANK[a.status] - OPEN_RANK[b.status] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/**
 * Opis karty pomysłu — tekst pierwszego akapitu dokumentu Tiptap. Nagłówki
 * pomijamy, bo szablony zaczynają się od „🎯 Cel projektu" i wszystkie karty
 * wyglądałyby tak samo.
 */
export function briefExcerpt(content: unknown, max = 160): string {
  const blocks = (content as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    const node = block as { type?: string } | null;
    if (!node || node.type !== "paragraph") continue;
    const text = nodeText(block).replace(/\s+/g, " ").trim();
    if (text === "") continue;
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }
  return "";
}

function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  return (n.content ?? []).map(nodeText).join("");
}
