"use client";

import { CHIP_HUE } from "@/components/ui/chip";
import { hueFor } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsOf, KIND_HUE, type ContactKind } from "./contact-model";

const FONT: Record<number, string> = { 22: "text-[10px]", 28: "text-2xs", 44: "text-md" };

/**
 * Two-letter avatar from E1: rounded square for companies, circle for people.
 * `Avatar` renders a single initial in a circle, so this stays local.
 */
export function InitialsTile({
  label,
  kind,
  size = 28,
  className,
}: {
  label: string;
  kind: ContactKind;
  size?: 22 | 28 | 44;
  className?: string;
}) {
  const person = kind === "person";
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-bold leading-none",
        person ? "rounded-full" : size >= 44 ? "rounded-lg" : "rounded-md",
        FONT[size],
        CHIP_HUE[person ? hueFor(label) : KIND_HUE[kind]],
        className,
      )}
    >
      {initialsOf(label)}
    </span>
  );
}
