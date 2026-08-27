import type { ShapeKind } from "./shape-node";

// Palety kanwy (B9): wypełnienia kształtów, karteczki, kolory pisaka.
// To dane kolorów wystawiane użytkownikowi w pickerach, nie warstwa stylu —
// dlatego literały hex, a nie tokeny, i dlatego poza komponentem.
export const PALETTE = [
  "#FFFFFF", // n-0
  "#1C1A17", // n-900 (chip-black-bg)
  "#FDE3E1", // chip-red-bg
  "#FFE8DB", // chip-orange-bg
  "#FBF0C8", // chip-yellow-bg
  "#DDF3E6", // chip-green-bg
  "#D8F1EF", // chip-teal-bg
  "#DDE9FC", // chip-blue-bg
  "#E3E4FB", // chip-indigo-bg
  "#EDE3FA", // chip-purple-bg
  "#FBE2EE", // chip-pink-bg
  "#EFE4DA", // chip-brown-bg
  "#EDEBE7", // chip-gray-bg
];

export const SHAPE_DEFAULTS: Record<ShapeKind, { width: number; height: number; color: string }> = {
  RECTANGLE: { width: 160, height: 80, color: "#FFFFFF" },
  DIAMOND: { width: 160, height: 80, color: "#FFFFFF" },
  CIRCLE: { width: 120, height: 120, color: "#FFFFFF" },
  STICKY: { width: 220, height: 120, color: "#FBF0C8" },
  FRAME: { width: 520, height: 320, color: "#FAF9F7" },
  // Fallback only — real size set in handleImageUpload after the PUT.
  IMAGE: { width: 280, height: 200, color: "#FFFFFF" },
  // TEXT uses colorHex as background + separate textColorHex for text color.
  TEXT: { width: 220, height: 60, color: "#FFFFFF" },
  // F12-K73 TASK_REF — task card sizing. Renderowany tylko w view 'taskline',
  // przez external drop z TaskLineSidebar.
  TASK_REF: { width: 264, height: 116, color: "#FFFFFF" },
};

export const STICKY_COLORS = [
  "#FBF0C8", // chip-yellow-bg (domyślna karteczka z B9)
  "#FBE2EE", // chip-pink-bg
  "#FFE8DB", // chip-orange-bg
  "#DDF3E6", // chip-green-bg
  "#DDE9FC", // chip-blue-bg
  "#EDE3FA", // chip-purple-bg
  "#FDE3E1", // chip-red-bg
  "#EDEBE7", // chip-gray-bg
];

// Kept parallel to STICKY_COLORS count so toolbar layout doesn't reflow when switching tools.
export const PEN_COLORS = [
  "#1C1A17", // n-900
  "#D6382C", // danger
  "#E8A100", // warning
  "#1E9E5A", // success
  "#2F6FE8", // info
  "#FF5C00", // orange-500
  "#8A1F52", // chip-pink-fg
  "#8A857D", // n-500
];

// Kolory kursorów obecnych osób (awareness). Muszą być rozróżnialne między
// sobą, więc też są danymi, nie tokenami.
export const CURSOR_COLORS = ["#FF5C00", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

// Biel i czerń dopisane do palety tekstu — w pickerze muszą być dostępne
// jawnie, bo tokeny tekstu zależą od tła kanwy.
export const TEXT_PALETTE = [...PALETTE, "#000000", "#FFFFFF"];

// Domyślne wypełnienie nowej karty/węzła.
export const DEFAULT_NODE_FILL = "#FFFFFF";

// Próbka „różne kolory" w pickerze, gdy zaznaczenie ma mieszane wartości.
export const MIXED_COLOR_SWATCH = "linear-gradient(90deg, #FF3B30, #0A84FF)";

// Pastele z palety v5 → ich pełny odcień (chip-*-fg / kolor statusu).
// Dzięki temu krawędź karteczki jest taka jak w B9 (#FBF0C8 → #E8A100).
export const V5_ACCENT: Record<string, string> = {
  "#FBF0C8": "#E8A100",
  "#DDF3E6": "#1E9E5A",
  "#FFE8DB": "#E04E00",
  "#DDE9FC": "#2F6FE8",
  "#FDE3E1": "#D6382C",
  "#EDE3FA": "#5A2E8A",
  "#FBE2EE": "#8A1F52",
  "#D8F1EF": "#0F5C57",
  "#E3E4FB": "#2F3A8F",
  "#EFE4DA": "#5C3A1E",
  "#EDEBE7": "#8A857D",
  "#FFFFFF": "#E6E3DE",
  "#1C1A17": "#1C1A17",
};

// Tusz na karteczce zależy od jasności wypełnienia — te trzy wartości muszą
// być jawne, bo liczy je funkcja, a nie klasa CSS.
export const INK_ON_PALE = "#4A4640";
export const INK_ON_DARK = "#FFFFFF";
export const INK_DEFAULT = "#1C1A17";
export const BORDER_ON_WHITE = "#E6E3DE";
