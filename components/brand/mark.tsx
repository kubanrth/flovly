// v5 brand mark: orange sphere with a rotated ink square clipped to the circle
// (from docs/redesign/v5 mockups). Universal — no letter, works for any name.
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  const id = `mark-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" className={className}>
      <clipPath id={id}>
        <circle cx="40" cy="40" r="40" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <circle cx="40" cy="40" r="40" fill="#FF5C00" />
        <rect x="50" y="50" width="48" height="48" transform="rotate(45 50 50)" fill="#14110D" />
      </g>
    </svg>
  );
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FLOVLY";

// Mark + wordmark, as in the top bar (15px/800/-0.4px) or larger on auth pages.
export function Wordmark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Mark size={lg ? 28 : 22} />
      <span
        className="font-extrabold text-ink"
        style={{ fontSize: lg ? 20 : 15, letterSpacing: lg ? "-0.6px" : "-0.4px" }}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
