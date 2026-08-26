"use client";
import { useEffect } from "react";

export const CMDK_OPEN_EVENT = "cmdk:open";
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(CMDK_OPEN_EVENT));
}

function inField(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

// Global single-key shortcuts: `?` → shortcuts sheet, `/` → ⌘K, `C` → new task.
// Ignored while typing or while any dialog is open. J/K/E live in the lists.
export function useHotkeys({ onShortcuts, onCreateTask }: { onShortcuts: () => void; onCreateTask: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target) || document.querySelector('[role="dialog"]')) return;
      if (e.key === "?") onShortcuts();
      else if (e.key === "/") openCommandPalette();
      else if (e.key === "c" || e.key === "C") onCreateTask();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onShortcuts, onCreateTask]);
}
