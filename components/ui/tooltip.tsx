"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps extends TooltipPrimitive.Root.Props {
  content: ReactNode;
  side?: TooltipPrimitive.Positioner.Props["side"];
  delay?: number;
  className?: string;
  children: ReactElement;
}

export function Tooltip({ content, side = "top", delay = 300, className, children, ...root }: TooltipProps) {
  return (
    <TooltipPrimitive.Root {...root}>
      <TooltipPrimitive.Trigger delay={delay} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-[110]">
          <TooltipPrimitive.Popup className={cn("inline-flex items-center gap-1.5 rounded-sm bg-n-900 px-2 py-1 text-2xs font-medium text-n-50 shadow-e1 transition-opacity duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 [&_kbd]:font-mono [&_kbd]:text-[10px] [&_kbd]:text-n-400", className)}>
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
