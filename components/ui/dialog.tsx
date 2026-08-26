"use client";

import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { IconClose } from "./icons";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return <DialogPrimitive.Backdrop className={cn("fixed inset-0 z-[60] bg-scrim transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0", className)} {...props} />;
}

export type DialogSize = "sm" | "md" | "lg" | "xl";
const SIZE: Record<DialogSize, string> = { sm: "sm:max-w-[440px]", md: "sm:max-w-[480px]", lg: "sm:max-w-[560px]", xl: "sm:max-w-[720px]" };

export function DialogContent({ className, children, size = "md", showCloseButton = true, ...props }: DialogPrimitive.Popup.Props & { size?: DialogSize; showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "dialog-surface fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden outline-none transition-[opacity,scale] duration-150 ease-[var(--ease-out)] data-starting-style:scale-[.98] data-starting-style:opacity-0 data-ending-style:opacity-0",
          SIZE[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close aria-label="Zamknij" className="absolute top-3 right-5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground">
            <IconClose width={14} height={14} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

export function DialogHeader({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex min-h-[52px] shrink-0 items-center gap-3 border-b border-border py-3 pr-14 pl-5", className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("truncate text-md font-semibold text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
