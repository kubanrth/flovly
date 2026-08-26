import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="label" className={cn("block text-xs font-medium leading-[18px] text-n-700 peer-disabled:text-n-400", className)} {...props} />;
}
