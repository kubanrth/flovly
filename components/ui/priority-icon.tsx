import type { SVGProps } from "react";

export type PriorityLevel = 0 | 1 | 2 | 3;
export const PRIORITY_LABEL: Record<PriorityLevel, string> = { 0: "Pilny", 1: "Wysoki", 2: "Średni", 3: "Niski" };

export function PriorityIcon({ level, size = 16, ...props }: SVGProps<SVGSVGElement> & { level: PriorityLevel; size?: number }) {
  const p = { stroke: `var(--prio-p${level})`, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" role="img" aria-label={`P${level} ${PRIORITY_LABEL[level]}`} {...props}>
      {level === 0 && <><path d="M4 7.2l4-4 4 4" {...p} /><path d="M4 12.2l4-4 4 4" {...p} /></>}
      {level === 1 && <path d="M4 10l4-4 4 4" {...p} />}
      {level === 2 && <path d="M4 6.2h8M4 9.8h8" {...p} />}
      {level === 3 && <path d="M4 6l4 4 4-4" {...p} />}
    </svg>
  );
}
