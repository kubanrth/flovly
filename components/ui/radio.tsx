"use client";

import type { ComponentProps, ReactNode } from "react";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { cn } from "@/lib/utils";

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive>) {
  return <RadioGroupPrimitive className={cn("flex flex-col gap-2.5", className)} {...props} />;
}

export function Radio({ label, size = "md", className, children, ...props }: RadioPrimitive.Root.Props & { label?: ReactNode; size?: "md" | "lg" }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm has-data-disabled:cursor-default has-data-disabled:text-n-400">
      <RadioPrimitive.Root
        className={cn(
          "shrink-0 rounded-full border-[1.5px] border-n-400 bg-card outline-none hover:border-n-500 data-checked:border-control-on data-disabled:border-n-200 data-disabled:bg-n-100",
          size === "lg" ? "size-5 data-checked:border-[6px]" : "size-4 data-checked:border-[5px]",
          className,
        )}
        {...props}
      />
      {label ?? children}
    </label>
  );
}
