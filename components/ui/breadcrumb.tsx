import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbProps {
  items: { label: React.ReactNode; href?: string }[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Okruszki" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {it.href && !last ? (
              <Link href={it.href} className="truncate text-muted-foreground no-underline hover:text-orange-800">{it.label}</Link>
            ) : (
              <span className="truncate" aria-current={last ? "page" : undefined}>{it.label}</span>
            )}
            {!last && <span className="text-n-400" aria-hidden="true">/</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
