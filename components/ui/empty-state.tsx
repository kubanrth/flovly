import { isValidElement, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  // Komponent ikony (lucide/Icon*) albo gotowy element.
  icon?: ElementType | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  // ponytail: tone zachowany dla zgodności, wizualnie jeden wariant (A1).
  tone?: "default" | "brand" | "muted";
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const Icon = !isValidElement(icon) && icon ? (icon as ElementType) : null;
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-input-border p-5 text-center", className)}>
      {icon && (
        <span className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-n-100 text-fg-3 [&_svg]:size-4">
          {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden /> : (icon as ReactNode)}
        </span>
      )}
      <div className="text-base font-semibold text-foreground">{title}</div>
      {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
