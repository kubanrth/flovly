"use client";

// F12-K75: kompaktowy badge prezentujący priorytet zadania.
// Używany w: tabela (kolumna), kanban card, drawer/modal taska.
// NONE → null (nie renderujemy, czysty look "domyślny task").

import { AlertCircle, ArrowUp, Minus, ChevronDown } from "lucide-react";
import {
  PRIORITY_META,
  type TaskPriorityValue,
} from "@/lib/task-priority";

const ICONS: Record<TaskPriorityValue, React.ComponentType<{ size?: number }>> = {
  URGENT: AlertCircle,
  HIGH: ArrowUp,
  MEDIUM: Minus,
  LOW: ChevronDown,
  NONE: () => null,
};

export function PriorityBadge({
  priority,
  size = "sm",
  showLabel = true,
}: {
  priority: TaskPriorityValue;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  if (priority === "NONE") return null;

  const meta = PRIORITY_META[priority];
  const Icon = ICONS[priority];

  const sizeCls =
    size === "xs"
      ? "h-5 px-1.5 text-[0.58rem] gap-1"
      : size === "md"
        ? "h-7 px-2.5 text-[0.78rem] gap-1.5"
        : "h-6 px-2 text-[0.66rem] gap-1.5";

  const iconSize = size === "xs" ? 9 : size === "md" ? 12 : 11;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-mono uppercase tracking-[0.1em] ${sizeCls} ${meta.color} ${meta.bg}`}
      title={`Priorytet: ${meta.label}`}
    >
      <Icon size={iconSize} />
      {showLabel && <span>{meta.shortCode}</span>}
    </span>
  );
}

// Kropka — używana w widokach gdzie miejsce ograniczone (np. wiersz tabeli
// w trybie kompaktowym). Tylko kolor, bez tekstu.
export function PriorityDot({
  priority,
  size = 8,
}: {
  priority: TaskPriorityValue;
  size?: number;
}) {
  if (priority === "NONE") return null;
  const meta = PRIORITY_META[priority];
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        background: meta.dotColor,
        width: size,
        height: size,
      }}
      title={`Priorytet: ${meta.label}`}
    />
  );
}
