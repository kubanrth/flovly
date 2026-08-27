// E9 „Support" — czysta logika skrzynki: kolejki, liczniki, kod zgłoszenia,
// mapowanie statusów i priorytetów na odcienie chipów. Bez Reacta i bez DOM.
// Self-check: `npx tsx components/support/support-model.check.ts`.

import type { ChipHue } from "@/components/ui/chip";

export type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SupportPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type QueueId = "open" | "in_progress" | "resolved";

export const STATUS_META: Record<SupportStatus, { label: string; hue: ChipHue }> = {
  OPEN: { label: "Otwarte", hue: "red" },
  IN_PROGRESS: { label: "W obsłudze", hue: "blue" },
  RESOLVED: { label: "Rozwiązane", hue: "green" },
  CLOSED: { label: "Zamknięte", hue: "gray" },
};

export const PRIORITY_META: Record<SupportPriority, { label: string; hue: ChipHue }> = {
  LOW: { label: "Niski", hue: "gray" },
  MEDIUM: { label: "Średni", hue: "blue" },
  HIGH: { label: "Wysoki", hue: "yellow" },
  URGENT: { label: "Pilny", hue: "red" },
};

export const STATUSES: SupportStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const PRIORITIES: SupportPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** Kolejka „Rozwiązane" pokazuje ostatnie 30 dni — jak w makiecie E9. */
export const RESOLVED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const QUEUES: { id: QueueId; label: string; hue: ChipHue }[] = [
  { id: "open", label: "Otwarte", hue: "red" },
  { id: "in_progress", label: "W obsłudze", hue: "blue" },
  { id: "resolved", label: "Rozwiązane (30 dni)", hue: "green" },
];

export interface QueueTicket {
  status: SupportStatus;
  /** ISO albo null — dla RESOLVED/CLOSED sprzed migracji bywa puste. */
  resolvedAt: string | null;
}

export function inQueue(ticket: QueueTicket, queue: QueueId, nowMs: number): boolean {
  if (queue === "open") return ticket.status === "OPEN";
  if (queue === "in_progress") return ticket.status === "IN_PROGRESS";
  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") return false;
  // Bez znacznika zamknięcia zgłoszenie i tak zostaje w kolejce — lepiej
  // pokazać za dużo niż zgubić ticket w czarnej dziurze.
  if (!ticket.resolvedAt) return true;
  const at = new Date(ticket.resolvedAt).getTime();
  if (!Number.isFinite(at)) return true;
  return nowMs - at <= RESOLVED_WINDOW_MS;
}

export function queueCounts<T extends QueueTicket>(
  tickets: T[],
  nowMs: number,
): Record<QueueId, number> {
  const out: Record<QueueId, number> = { open: 0, in_progress: 0, resolved: 0 };
  for (const t of tickets) {
    for (const q of QUEUES) if (inQueue(t, q.id, nowMs)) out[q.id] += 1;
  }
  return out;
}

/**
 * Widoczny uchwyt zgłoszenia. Bierzemy ogon cuid-a zamiast numeru
 * porządkowego, bo `SupportTicket` nie ma licznika, a numerowanie po
 * kolejności tworzenia przenumerowałoby wszystko po każdym usunięciu.
 */
export function ticketCode(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `SUP-${clean.slice(-5) || "?????"}`;
}

export interface SupportMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface SupportAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploaderId: string;
}

export interface SupportTicketRow {
  id: string;
  title: string;
  description: string;
  status: SupportStatus;
  priority: SupportPriority;
  dueAt: string | null;
  isUrgent: boolean;
  createdAt: string;
  resolvedAt: string | null;
  reporter: SupportMember;
  assignee: SupportMember | null;
  attachments: SupportAttachment[];
  /** Etykiety liczone na serwerze w Europe/Warsaw — SSR i klient muszą się zgadzać. */
  listTime: string;
  createdLabel: string;
  dueLabel: string | null;
  /** „2 godz. 14 min" — ile trwało zamknięcie; null gdy jeszcze otwarte. */
  resolvedIn: string | null;
}

export const personLabel = (p: { name: string | null; email: string }) =>
  p.name ?? p.email.split("@")[0] ?? p.email;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Serwer odrzuca pliki bez MIME (np. .heic) — mapujemy po rozszerzeniu. */
export function inferContentType(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
    txt: "text/plain", csv: "text/csv", md: "text/markdown",
  };
  return ext && map[ext] ? map[ext] : "application/octet-stream";
}

export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain";
