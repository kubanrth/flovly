"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

// Wspólna klasa wszystkich pływających popupów (menu, select, combobox, popover).
export const POPUP_CLASS =
  "popover-surface shadow-e2 origin-(--transform-origin) outline-none transition-[opacity,translate] duration-150 ease-[var(--ease-out)] data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0";
export const POPUP_ITEM_CLASS =
  "flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-foreground outline-none data-highlighted:bg-n-100 data-disabled:text-n-400 [&_svg]:size-3.5 [&_svg]:shrink-0";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export type PopoverContentProps = PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

export function PopoverContent({ className, side = "bottom", align = "start", sideOffset = 4, alignOffset = 0, ...props }: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} className="z-[100] outline-none">
        <PopoverPrimitive.Popup data-slot="popover-content" className={cn(POPUP_CLASS, "p-2.5", className)} {...props} />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return <PopoverPrimitive.Title className={cn("text-sm font-semibold", className)} {...props} />;
}
export function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return <PopoverPrimitive.Description className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
