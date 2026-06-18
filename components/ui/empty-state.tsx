import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// FLOVLY v4 Empty State — mirror "Flovly States & Mobile.dc.html" linie 31-45.
// Layout: 64×64 rounded-square icon container w/ brand-tinted bg + border,
// 17px headline + 13px muted body + optional CTA, wszystko z radial aura
// blur za kontenerem (subtelne brand glow).
//
// Trzy tones:
//   - default: brand-tinted aura + icon bg
//   - brand:   stronger brand presence (CTA-heavy states)
//   - muted:   neutralna paleta (drugorzędne miejsca, np. puste filtry)
//
// Używany WSZĘDZIE gdzie wcześniej był inline "Brak …" markup.
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "brand" | "muted";
  // Pozwala na drobne korekty padding/margin per call site bez forka komponentu.
  className?: string;
}

const TONE_AURA: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "bg-[radial-gradient(circle,rgba(124,92,255,0.22),transparent_65%)]",
  brand: "bg-[radial-gradient(circle,rgba(210,71,181,0.26),transparent_65%)]",
  muted: "bg-[radial-gradient(circle,rgba(124,92,255,0.10),transparent_65%)]",
};

const TONE_ICON_BG: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  // 12% brand fill + 25% border per spec.
  default:
    "bg-[color-mix(in_oklch,var(--brand-500)_12%,transparent)] border-[color-mix(in_oklch,var(--brand-500)_25%,transparent)]",
  brand:
    "bg-[color-mix(in_oklch,var(--accent-brand-2)_14%,transparent)] border-[color-mix(in_oklch,var(--accent-brand-2)_30%,transparent)]",
  muted: "bg-muted/60 border-border",
};

const TONE_ICON_COLOR: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "text-[var(--brand-500)]",
  brand: "text-[var(--accent-brand-2)]",
  muted: "text-muted-foreground",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden px-6 py-10 text-center",
        className,
      )}
    >
      {/* Radial aura blob — sits behind the icon, mirror spec linia 37.
          Pointer-events-none + aria-hidden — czysto dekoracyjne. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1 -z-10 h-[220px] w-[220px] -translate-x-1/2 rounded-full blur-3xl",
          TONE_AURA[tone],
        )}
      />

      {/* 64×64 rounded square icon container per spec line 38. */}
      <div
        className={cn(
          "relative grid h-16 w-16 place-items-center rounded-[19px] border",
          TONE_ICON_BG[tone],
        )}
      >
        <Icon
          size={28}
          strokeWidth={1.75}
          className={TONE_ICON_COLOR[tone]}
          aria-hidden
        />
      </div>

      {/* 17px headline · 13px body — spec lines 39-40. font-display żeby pasowało
          do reszty UI. */}
      <h2 className="mt-[18px] font-display text-[1.0625rem] font-bold leading-tight tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 max-w-[290px] text-[0.8125rem] leading-[1.5] text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-[18px]">{action}</div>}
    </div>
  );
}
