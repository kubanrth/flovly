import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return <kbd className={cn("inline-block rounded-sm border border-border border-b-2 bg-canvas px-[5px] font-mono text-2xs leading-[18px] text-muted-foreground", className)} {...props} />;
}
