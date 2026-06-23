/**
 * F12-K104: Semantic z-index tokens — single source of truth.
 *
 * Hierarchia stacking — od najniższego do najwyższego:
 * - in-flow content + sticky table headers + dropdowns inside flows
 * - floating overlays nie-modal (toaster, ad-hoc badges)
 * - modal/drawer backdrops + popups
 * - popovers/dropdowns RENDEROWANE WEWNĄTRZ modal'i (muszą być WYŻEJ
 *   niż modal popup, bo ich rodzic mountuje się na sam wierzch)
 * - tooltips (zawsze topmost żeby user widział label dla każdego elementu)
 *
 * Numerologia z odstępem 10 — łatwe insertowanie nowych warstw.
 */
export const Z = {
  base: 0, // bottom of stacking
  dropdown: 30, // table sort menus, simple dropdowns in-flow
  sticky: 40, // sticky table headers, sticky bottoms
  fab: 50, // floating action buttons (Ateron, FAB notes)
  toast: 80, // NotificationToaster + ReminderPopups
  mobileNav: 90, // mobile sidebar hamburger trigger
  modalBackdrop: 100, // Dialog backdrop overlay
  modal: 110, // Dialog content / drawer popup
  popoverInModal: 200, // dropdowns/popovers portalled, muszą wyjść nad modal (110)
  tooltip: 300, // ZAWSZE topmost
} as const;

// Tailwind klasy do bezpośredniego użycia jako className:
export const ZCls = {
  base: "z-0",
  dropdown: "z-[30]",
  sticky: "z-[40]",
  fab: "z-[50]",
  toast: "z-[80]",
  mobileNav: "z-[90]",
  modalBackdrop: "z-[100]",
  modal: "z-[110]",
  popoverInModal: "z-[200]",
  tooltip: "z-[300]",
} as const;
