import type { ChipHue } from "@/components/ui/chip";

// Status/tag/select colors live in the DB as arbitrary hex; chips know only the
// 12 v5 hues, so snap by HSL hue. Snap arbitrary DB hex to one of the 12 chip hues.
// Used by table cells, task panel, tools and pickers.
export function hueForColor(hex: string | null | undefined): ChipHue {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return "gray";
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.12) return "black";
  if (s < 0.18) return "gray";
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (h >= 15 && h < 70 && l < 0.35) return "brown";
  if (h < 15 || h >= 345) return "red";
  if (h < 36.5) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 195) return "teal";
  if (h < 235) return "blue";
  if (h < 260) return "indigo";
  if (h < 300) return "purple";
  return "pink";
}
