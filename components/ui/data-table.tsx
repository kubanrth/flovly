import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";
const ALIGN: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };

export function DataTable({ className, wrapperClassName, footer, children, ...props }: ComponentProps<"table"> & { wrapperClassName?: string; footer?: ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-sm border border-border", wrapperClassName)}>
      <div className="overflow-auto">
        <table data-ui="datatable" className={cn("w-full border-collapse text-sm", className)} {...props}>{children}</table>
      </div>
      {footer}
    </div>
  );
}

export function DataThead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 z-[1] bg-table-header", className)} {...props} />;
}

export function DataTh({ icon, align = "left", width, className, style, children, ...props }: ComponentProps<"th"> & { icon?: ReactNode; align?: Align; width?: number | string }) {
  return (
    <th
      style={{ width, ...style } as CSSProperties}
      className={cn("h-(--table-header-h) border-r border-b border-border border-r-table-grid px-2.5 align-middle text-2xs font-semibold tracking-[.06em] whitespace-nowrap text-muted-foreground uppercase last:border-r-0", ALIGN[align], className)}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-n-500">{icon}{children}</span>
    </th>
  );
}

export function DataTr({ selected, className, ...props }: ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn("h-(--row-h) hover:bg-row-hover data-selected:bg-selected [&[data-selected]>td:first-child]:shadow-[inset_2px_0_0_var(--orange-500)]", className)}
      {...props}
    />
  );
}

export function DataTd({ align = "left", className, ...props }: ComponentProps<"td"> & { align?: Align }) {
  return <td className={cn("border-r border-b border-n-100 border-r-table-grid px-2.5 align-middle last:border-r-0 [tr:last-child>&]:border-b-0", ALIGN[align], className)} {...props} />;
}

export function DataFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex h-8 items-center gap-3 border-t border-border bg-canvas px-2.5 font-mono text-2xs text-muted-foreground", className)} {...props} />;
}
