"use client";

import type { ComponentProps, ReactNode } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { cn } from "@/lib/utils";
import { IconCheckCircle, IconClose } from "./icons";

export interface ToastCardProps extends Omit<ComponentProps<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
}

export function ToastCard({ title, description, icon, onClose, className, ...props }: ToastCardProps) {
  return (
    <div className={cn("toast-card surface flex w-[300px] items-start gap-2.5 p-3 shadow-e2 transition-opacity duration-100 data-ending-style:opacity-0", className)} {...props}>
      <span className="mt-0.5 shrink-0 text-success [&_svg]:size-4">{icon ?? <IconCheckCircle />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {onClose && (
        <button type="button" aria-label="Zamknij" onClick={onClose} className="shrink-0 rounded-[2px] text-n-500 outline-none hover:text-foreground">
          <IconClose width={14} height={14} />
        </button>
      )}
    </div>
  );
}

export const ToastProvider = ToastPrimitive.Provider;
export const useToast = ToastPrimitive.useToastManager;

// Viewport prawy-dolny róg; auto-zamykanie po timeout z ToastProvider (domyślnie 5 s).
export function Toaster() {
  const { toasts, close } = ToastPrimitive.useToastManager();
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-(--z-toast) flex w-[300px] flex-col-reverse gap-2 outline-none">
        {toasts.map((t) => (
          <ToastPrimitive.Root key={t.id} toast={t} render={<ToastCard title={t.title} description={t.description} onClose={() => close(t.id)} />} />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}
