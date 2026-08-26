"use client";

// Bits shared by the desktop grid and the mobile day list: status → pill
// colours and the „Dodaj zadanie na <data>" quick add.

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction, patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { cn } from "@/lib/utils";
import { CHIP_HUE, type ChipHue } from "@/components/ui/chip";
import { IconPlus } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { parseDayKey, shortDate } from "./calendar-math";

// 3px status bar inside a pill — same hues as the chip dots.
const BAR: Record<ChipHue, string> = {
  gray: "bg-n-500", orange: "bg-orange-600", red: "bg-danger", yellow: "bg-warning", green: "bg-success", teal: "bg-chip-teal-fg",
  blue: "bg-info", indigo: "bg-chip-indigo-fg", purple: "bg-chip-purple-fg", pink: "bg-chip-pink-fg", brown: "bg-chip-brown-fg", black: "bg-n-400",
};

export function statusHue(color: string | null | undefined): ChipHue {
  return color ? hueForColor(color) : "gray";
}

export const pillSurface = (hue: ChipHue) => CHIP_HUE[hue];
export const barClass = (hue: ChipHue) => BAR[hue];

/** 3px status bar; `tall` = the 14px variant used in the day popover. */
export function StatusBar({ hue, tall, className }: { hue: ChipHue; tall?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn("w-[3px] shrink-0 rounded-[1px]", tall ? "h-3.5" : "h-3", BAR[hue], className)} />;
}

/**
 * Inline quick add — same pattern as the Lista „+ Dodaj zadanie" row. The new
 * task starts on `day` at 09:00, so it shows up in that cell right away.
 */
export function QuickAddTask({
  workspaceId,
  boardId,
  day,
  size = "sm",
  onDone,
}: {
  workspaceId: string;
  boardId: string;
  day: string;
  size?: "sm" | "lg";
  onDone?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const date = parseDayKey(day);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || busy) {
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("title", trimmed);
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await createTaskAction(null, fd);
        if (res?.ok) {
          const at = new Date(date);
          at.setHours(9, 0, 0, 0);
          const patch = new FormData();
          patch.set("id", res.taskId);
          patch.set("startAt", at.toISOString());
          await patchTaskAction(patch);
        }
      } catch {
        // Zadanie mogło powstać bez daty — refresh niżej pokaże stan prawdziwy.
      }
      setTitle("");
      setBusy(false);
      setEditing(false);
      router.refresh();
      onDone?.();
    });
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        maxLength={200}
        disabled={busy}
        placeholder="Tytuł zadania…"
        aria-label={`Nowe zadanie na ${shortDate(date)}`}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !busy && submit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setTitle("");
            setEditing(false);
          }
        }}
        className={cn(
          "w-full rounded-sm border border-input-border bg-card px-2.5 text-foreground outline-none hover:border-input-border-hover focus-visible:border-orange-500 focus-visible:shadow-[var(--focus)]",
          size === "lg" ? "h-11 text-base" : "h-8 text-xs",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md font-semibold outline-none",
        size === "lg"
          ? "h-11 w-full bg-orange-500 text-base text-ink hover:bg-orange-600 active:bg-orange-700 focus-visible:shadow-[var(--focus)]"
          : "h-7 w-full justify-start gap-1.5 px-0 text-xs font-medium text-orange-700 hover:text-orange-800 hover:underline active:text-orange-900 focus-visible:shadow-[var(--focus)]",
      )}
    >
      <IconPlus width={size === "lg" ? 16 : 11} height={size === "lg" ? 16 : 11} strokeWidth={1.8} />
      Dodaj zadanie na {shortDate(date)}
    </button>
  );
}
