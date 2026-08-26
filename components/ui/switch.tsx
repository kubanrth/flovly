"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function Switch({ size = "md", className, ...props }: SwitchPrimitive.Root.Props & { size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <SwitchPrimitive.Root
      className={cn("inline-flex shrink-0 items-center rounded-full bg-n-300 outline-none data-checked:bg-control-on data-disabled:opacity-50", sm ? "h-4 w-7 p-0.5" : "h-6 w-10 p-[3px]", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className={cn("block rounded-full bg-card shadow-sm transition-transform duration-150 ease-[var(--ease-out)]", sm ? "size-3 data-checked:translate-x-3" : "size-[18px] data-checked:translate-x-4")} />
    </SwitchPrimitive.Root>
  );
}
