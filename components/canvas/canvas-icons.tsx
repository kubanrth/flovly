// Ikony 1:1 z makiety v5 `docs/redesign/v5/B9-whiteboard.dc.html` (dolny
// toolbar). Reszta ikon leci z `components/ui/icons.tsx` — tu tylko te,
// których wspólny zestaw nie ma.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: P) {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}
const s = { stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconShapeRect(p: P) {
  return <Svg {...p}><rect x="2.5" y="4" width="11" height="8.5" rx="1.5" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconShapeCircle(p: P) {
  return <Svg {...p}><circle cx="8" cy="8" r="5.5" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconShapeDiamond(p: P) {
  return <Svg {...p}><path d="M8 2.5L13.5 8 8 13.5 2.5 8 8 2.5z" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconShapeFrame(p: P) {
  return <Svg {...p}><rect x="2.5" y="2.5" width="11" height="11" rx="2" {...s} strokeWidth={1.4} /><path d="M5.5 8h5M8 5.5v5" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconShapeText(p: P) {
  return <Svg {...p}><path d="M3.5 4V3h9v1M8 3.4v9.2M6 12.6h4" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconRedo(p: P) {
  return <Svg {...p}><path d="M9.5 3.5L13 7l-3.5 3.5M13 7H6a3 3 0 0 0 0 6h2" {...s} strokeWidth={1.4} /></Svg>;
}
export function IconMinusSmall(p: P) {
  return <Svg {...p}><path d="M3.5 8h9" {...s} strokeWidth={1.5} /></Svg>;
}
export function IconPlusSmall(p: P) {
  return <Svg {...p}><path d="M8 3.5v9M3.5 8h9" {...s} strokeWidth={1.5} /></Svg>;
}
export function IconTaskCard(p: P) {
  return <Svg {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.5" {...s} strokeWidth={1.4} /><path d="M4.5 6.5h3M4.5 9.5h7" {...s} strokeWidth={1.4} /></Svg>;
}
