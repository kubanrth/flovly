// Centralna paleta dla pickerów (tagi, statusy, select fields, event,
// brief header, roadmap, kanban).
// Typowanie `string[]` zamiast `as const` — picker'y trzymają state jako
// `string`, literal-tuple powodowałby type error przy zapisie.
export const BRAND_PALETTE: string[] = [
  "#FF3B30", // red — żywszy niż Tailwind red-500
  "#FF9500", // orange
  "#FFCC00", // yellow / amber — saturated, nie muddy
  "#34C759", // green — iOS-style, jaskrawszy niż emerald-500
  "#00CDD8", // teal / cyan
  "#0A84FF", // blue — soczysty
  "#7B68EE", // brand purple
  "#FF2D9C", // magenta — bliżej brand secondary
];

export const STATUS_PALETTE = BRAND_PALETTE;
export const TAG_PALETTE = BRAND_PALETTE;
export const SELECT_PALETTE = BRAND_PALETTE;
export const EVENT_PALETTE = BRAND_PALETTE;
export const TIMELINE_PALETTE = BRAND_PALETTE;
export const HEADER_PALETTE = BRAND_PALETTE;
