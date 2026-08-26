"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@/lib/utils";
import { CHIP_HUE, type ChipHue } from "./chip";

const HUES: ChipHue[] = ["blue", "green", "purple", "pink", "teal", "indigo", "orange", "yellow", "brown", "red"];
export function hueFor(name: string): ChipHue {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export type AvatarSize = 20 | 22 | 24 | 26 | 28 | 32 | 44;
const FONT: Record<AvatarSize, number> = { 20: 9, 22: 9, 24: 11, 26: 11, 28: 12, 32: 13, 44: 16 };

export interface AvatarProps extends Omit<AvatarPrimitive.Root.Props, "children"> {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  hue?: ChipHue;
}

export function Avatar({ name, src, size = 24, hue, className, style, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      title={name}
      className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none", CHIP_HUE[hue ?? hueFor(name)], className)}
      style={{ width: size, height: size, fontSize: FONT[size], ...style }}
      {...props}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback>{name.trim().charAt(0).toUpperCase()}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export interface AvatarStackProps {
  people: { name: string; src?: string | null; hue?: ChipHue }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarStack({ people, max = 3, size = 24, className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const overlap = size >= 24 ? "-ml-[7px]" : "-ml-1.5";
  return (
    <span className={cn("inline-flex", className)}>
      {shown.map((p, i) => <Avatar key={`${p.name}-${i}`} {...p} size={size} className={cn("border-2 border-card", i > 0 && overlap)} />)}
      {rest > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full border-2 border-card bg-n-100 font-semibold leading-none text-muted-foreground", overlap)} style={{ width: size, height: size, fontSize: FONT[size] - 1 }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
