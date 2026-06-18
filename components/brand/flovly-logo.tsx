// F12-K80 (v4 design): nowy logo system. 3 warianty:
//  - <FlovlyMark> — sam glyph (kwadrat z gradient'em + chevron, do icon)
//  - <FlovlyWordmark> — "FLOVLY" tekst (z opcjonalnym gradient na 'V')
//  - <FlovlySignature> — mark + wordmark obok
//
// Wszystko z brand gradient'em #7C5CFF → #D247B5 (140deg).

import * as React from "react";

const GRADIENT_ID = "flovly-brand-gradient";

function GradientDef() {
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C5CFF" />
        <stop offset="100%" stopColor="#D247B5" />
      </linearGradient>
    </defs>
  );
}

// Sam glyph (kwadrat z gradient'em + double chevron-V wewnątrz).
// Używany jako favicon / app icon / sidebar mark.
export function FlovlyMark({
  size = 32,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FLOVLY"
    >
      <GradientDef />
      {/* Rounded square z gradient'em */}
      <rect
        x="0"
        y="0"
        width="48"
        height="48"
        rx="14"
        fill={`url(#${GRADIENT_ID})`}
      />
      {/* Top sheen — daje glassy feel */}
      <rect
        x="0"
        y="0"
        width="48"
        height="24"
        rx="14"
        fill="url(#flovly-sheen)"
        opacity="0.35"
      />
      <defs>
        <linearGradient id="flovly-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Double chevron V — symbol "flow" */}
      <path
        d="M10 13L24 32L38 13"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <path
        d="M10 22L24 41L38 22"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// "FLOVLY" wordmark z opcjonalnym gradient'owym 'V' w środku.
// Sizes: sm / md / lg → różne rozmiary fontu.
export function FlovlyWordmark({
  size = "md",
  gradientV = true,
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  gradientV?: boolean;
  className?: string;
}) {
  const fontSize =
    size === "sm" ? 18 : size === "lg" ? 32 : size === "xl" ? 44 : 24;
  return (
    <span
      className={`inline-flex items-baseline font-display font-extrabold tracking-[-0.04em] text-foreground ${className ?? ""}`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
      aria-label="FLOVLY"
    >
      <span>FLO</span>
      {gradientV ? <span className="text-brand-gradient">V</span> : <span>V</span>}
      <span>LY</span>
    </span>
  );
}

// Mark + wordmark side-by-side. Default w sidebar header'ze + auth pages.
export function FlovlySignature({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const markSize = size === "sm" ? 24 : size === "lg" ? 40 : 32;
  const textSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
  return (
    <div className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <FlovlyMark size={markSize} />
      <FlovlyWordmark size={textSize} gradientV={false} />
    </div>
  );
}
