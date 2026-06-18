// F12-K75: Task priority — meta + helpers.

import type { TaskPriority } from "@/lib/generated/prisma/enums";

export type TaskPriorityValue = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

// Wszystkie priorytety w kolejności prezentacji (od najpilniejszego do "brak").
// URGENT na górze żeby user widział od razu opcję "ASAP".
export const PRIORITY_VALUES: TaskPriorityValue[] = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "LOW",
  "NONE",
];

// Sort weight — używamy do sortowania w widokach. URGENT najwyżej (0),
// NONE najniżej (4). Stabilne, deterministyczne.
export const PRIORITY_WEIGHT: Record<TaskPriorityValue, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

type PriorityMeta = {
  value: TaskPriorityValue;
  label: string; // krótka PL nazwa
  shortCode: string; // pill marker "P0".."P3" / brak
  color: string; // text-color klasa Tailwind
  bg: string; // background pill klasa
  border: string; // border klasa dla outline'owych przycisków
  dotColor: string; // hex do inline style (np. status dot)
};

export const PRIORITY_META: Record<TaskPriorityValue, PriorityMeta> = {
  URGENT: {
    value: "URGENT",
    label: "Pilne",
    shortCode: "P0",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    dotColor: "#E11D48",
  },
  HIGH: {
    value: "HIGH",
    label: "Wysoki",
    shortCode: "P1",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    dotColor: "#F59E0B",
  },
  MEDIUM: {
    value: "MEDIUM",
    label: "Średni",
    shortCode: "P2",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-500/15",
    border: "border-sky-500/40",
    dotColor: "#0EA5E9",
  },
  LOW: {
    value: "LOW",
    label: "Niski",
    shortCode: "P3",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    dotColor: "#64748B",
  },
  NONE: {
    value: "NONE",
    label: "Brak",
    shortCode: "—",
    color: "text-muted-foreground/70",
    bg: "bg-transparent",
    border: "border-border",
    dotColor: "#94A3B8",
  },
};

// Type-safe assertion że wartość z form / URL / DB jest legalna.
// Używamy gdy parsujemy input (createTaskAction, filtrowanie URL).
export function isTaskPriority(v: unknown): v is TaskPriorityValue {
  return (
    v === "NONE" ||
    v === "LOW" ||
    v === "MEDIUM" ||
    v === "HIGH" ||
    v === "URGENT"
  );
}

// Cast — Prisma enum import vs naszego stringowego typu. Identyczne na
// poziomie runtime, różne na poziomie TS.
export function asPrismaPriority(v: TaskPriorityValue): TaskPriority {
  return v as TaskPriority;
}
