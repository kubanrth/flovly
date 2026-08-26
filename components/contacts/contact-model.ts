import type { ChipHue } from "@/components/ui/chip";

// E1 „Kontakty” — pure helpers shared by the table, the card panel and the
// mobile list. No React, no I/O, so `contact-model.check.ts` can assert them.

export interface ContactOwner {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface ContactRow {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  nip: string | null;
  city: string | null;
  /** Open + closed deals pointing at this contact — drives „Klient” vs „Dostawca”. */
  dealCount: number;
  owner: ContactOwner | null;
  /** ISO. Newest activity/message, `updatedAt` when the contact has neither. */
  lastContactAt: string;
  /** Short label after the date in the „Ostatni kontakt” cell. */
  lastContactNote: string | null;
}

export type ContactKind = "client" | "supplier" | "person";

export const KIND_LABEL: Record<ContactKind, string> = {
  client: "Klient",
  supplier: "Dostawca",
  person: "Osoba",
};

export const KIND_HUE: Record<ContactKind, ChipHue> = {
  client: "green",
  supplier: "indigo",
  person: "gray",
};

export const KIND_ORDER: ContactKind[] = ["client", "supplier", "person"];

type NameParts = Pick<ContactRow, "companyName" | "firstName" | "lastName">;

/**
 * Schema has no `Contact.type` column (D7 — no migrations in this round), so
 * the chip is derived: a record with a personal name is a person, a bare
 * company with deals is a customer, a bare company without deals a supplier.
 */
export function contactKind(c: NameParts & { dealCount?: number }): ContactKind {
  if (c.firstName || c.lastName) return "person";
  return (c.dealCount ?? 0) > 0 ? "client" : "supplier";
}

export function contactName(c: NameParts & { email?: string | null }): string {
  const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return person || c.companyName || c.email || "—";
}

/** „klient · sklep kibica”, „Legia · e-commerce manager”, „księgowość zewnętrzna”. */
export function contactSubtitle(
  c: NameParts & { position: string | null; city: string | null; dealCount?: number },
): string | null {
  const kind = contactKind(c);
  const lead = kind === "person" ? c.companyName : KIND_LABEL[kind].toLowerCase();
  return [lead, c.position ?? c.city].filter(Boolean).join(" · ") || null;
}

/** Up to two letters for the avatar tile; digits and punctuation dropped. */
export function initialsOf(label: string): string {
  const words = label.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return letters || "?";
}

const WEEKDAY = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];
const MONTH = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** „dziś” · „wczoraj” · „pon” (< 7 dni) · „22 sie” · „22 sie 2025”. */
export function formatLastContact(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (days === 0) return "dziś";
  if (days === 1) return "wczoraj";
  if (days > 1 && days < 7) return WEEKDAY[d.getDay()]!;
  const short = `${d.getDate()} ${MONTH[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? short : `${short} ${d.getFullYear()}`;
}

export interface ContactFilter {
  q: string;
  kind: ContactKind | "all";
  ownerId: string | "all" | "none";
}

export const EMPTY_FILTER: ContactFilter = { q: "", kind: "all", ownerId: "all" };

export function filterContacts(rows: ContactRow[], f: ContactFilter): ContactRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.kind !== "all" && contactKind(r) !== f.kind) return false;
    if (f.ownerId === "none" && r.owner) return false;
    if (f.ownerId !== "all" && f.ownerId !== "none" && r.owner?.id !== f.ownerId) return false;
    if (!q) return true;
    return [r.companyName, r.firstName, r.lastName, r.email, r.phone, r.nip, r.position, r.city]
      .some((v) => v?.toLowerCase().includes(q));
  });
}

/** Header copy from the mockup — one string for every count. */
export const contactsCountLabel = (n: number) => `${n} firm i osób`;

/** Flattens a Tiptap doc to one line for the history list in the card panel. */
export function docText(doc: unknown, max = 120): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
