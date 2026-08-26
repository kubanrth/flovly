"use client";

import type { ComponentProps } from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { IconClose } from "./icons";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return <SheetPrimitive.Backdrop className={cn("fixed inset-0 z-[60] bg-scrim transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0", className)} {...props} />;
}

export type SheetSide = "right" | "left" | "bottom" | "top";
const SIDE: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 h-full w-(--panel) max-w-full border-l border-border bg-card shadow-e2 data-starting-style:translate-x-2 data-ending-style:translate-x-2",
  left: "inset-y-0 left-0 h-full w-[300px] max-w-full border-r border-border bg-card shadow-e2 data-starting-style:-translate-x-2 data-ending-style:-translate-x-2",
  bottom: "sheet-mobile-surface inset-x-0 bottom-0 max-h-[90dvh] data-starting-style:translate-y-2 data-ending-style:translate-y-2",
  top: "inset-x-0 top-0 border-b border-border bg-card shadow-e2 data-starting-style:-translate-y-2 data-ending-style:-translate-y-2",
};

export interface SheetContentProps extends SheetPrimitive.Popup.Props {
  side?: SheetSide;
  showCloseButton?: boolean;
  // false = panel bez scrimu (zadanie 600px nad listą); ustaw też modal={false} na <Sheet>.
  modal?: boolean;
}

export function SheetContent({ className, children, side = "right", showCloseButton = true, modal = true, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      {modal && <SheetOverlay />}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn("fixed flex flex-col outline-none transition-[opacity,translate] duration-200 ease-[var(--ease-out)] data-starting-style:opacity-0 data-ending-style:opacity-0", modal ? "z-[60]" : "z-(--z-panel)", SIDE[side], className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close aria-label="Zamknij" className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground">
            <IconClose width={14} height={14} />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex shrink-0 flex-col gap-0.5 border-b border-border px-4 py-3 pr-12", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3", className)} {...props} />;
}
export function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return <SheetPrimitive.Title className={cn("text-md font-semibold text-foreground", className)} {...props} />;
}
export function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return <SheetPrimitive.Description className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
