import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconClose } from "./icons";

export type ChipHue = "gray" | "orange" | "red" | "yellow" | "green" | "teal" | "blue" | "indigo" | "purple" | "pink" | "brown" | "black";
export type ChipSize = "sm" | "md" | "lg";

export const CHIP_HUE: Record<ChipHue, string> = {
  gray: "bg-chip-gray-bg text-chip-gray-fg",
  orange: "bg-chip-orange-bg text-chip-orange-fg",
  red: "bg-chip-red-bg text-chip-red-fg",
  yellow: "bg-chip-yellow-bg text-chip-yellow-fg",
  green: "bg-chip-green-bg text-chip-green-fg",
  teal: "bg-chip-teal-bg text-chip-teal-fg",
  blue: "bg-chip-blue-bg text-chip-blue-fg",
  indigo: "bg-chip-indigo-bg text-chip-indigo-fg",
  purple: "bg-chip-purple-bg text-chip-purple-fg",
  pink: "bg-chip-pink-bg text-chip-pink-fg",
  brown: "bg-chip-brown-bg text-chip-brown-fg",
  black: "bg-chip-black-bg text-chip-black-fg",
};
const DOT: Record<ChipHue, string> = {
  gray: "bg-n-500", orange: "bg-orange-500", red: "bg-danger", yellow: "bg-warning", green: "bg-success", teal: "bg-chip-teal-fg",
  blue: "bg-info", indigo: "bg-chip-indigo-fg", purple: "bg-chip-purple-fg", pink: "bg-chip-pink-fg", brown: "bg-chip-brown-fg", black: "bg-n-400",
};
const SIZE: Record<ChipSize, string> = { sm: "h-[18px] gap-[5px] px-1.5 text-2xs", md: "h-5 gap-1.5 px-[7px] text-2xs", lg: "h-6 gap-1.5 px-[9px] text-xs" };
const DOT_SIZE: Record<ChipSize, string> = { sm: "size-[5px]", md: "size-1.5", lg: "size-1.5" };

export interface ChipProps extends ComponentProps<"span"> {
  hue?: ChipHue;
  dot?: boolean;
  size?: ChipSize;
  onRemove?: () => void;
}

export function Chip({ hue = "gray", dot, size = "md", onRemove, className, children, ...props }: ChipProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-sm font-medium leading-none", SIZE[size], CHIP_HUE[hue], onRemove && "pr-[5px]", className)} {...props}>
      {dot && <span className={cn("shrink-0 rounded-full", DOT_SIZE[size], DOT[hue])} />}
      {children}
      {onRemove && (
        <button type="button" aria-label="Usuń" onClick={onRemove} className="-mr-0.5 inline-flex size-3.5 items-center justify-center rounded-[2px] opacity-70 outline-none hover:opacity-100">
          <IconClose width={12} height={12} strokeWidth={1.6} />
        </button>
      )}
    </span>
  );
}

export function StatusChip({ label, hue, dot = true, size, className }: { label: ReactNode; hue: ChipHue; dot?: boolean; size?: ChipSize; className?: string }) {
  return <Chip hue={hue} dot={dot} size={size} className={className}>{label}</Chip>;
}

export function TagChip({ label, hue = "gray", onRemove, size = "md", className }: { label: ReactNode; hue?: ChipHue; onRemove?: () => void; size?: ChipSize; className?: string }) {
  return <Chip hue={hue} size={size} onRemove={onRemove} className={className}>{label}</Chip>;
}

export function FilterChip({ label, onRemove, className }: { label: ReactNode; onRemove?: () => void; className?: string }) {
  return <Chip hue="orange" size="lg" onRemove={onRemove} data-ui="filter-chip" className={className}>{label}</Chip>;
}
