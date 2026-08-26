import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-lg px-1 text-[10px] font-semibold leading-none",
  {
    variants: { tone: { red: "bg-danger text-white", gray: "bg-chip-gray-bg text-chip-gray-fg", orange: "bg-chip-orange-bg text-chip-orange-fg" } },
    defaultVariants: { tone: "gray" },
  },
);

export function Badge({ tone, className, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
