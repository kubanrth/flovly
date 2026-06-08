"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";

type Layout = "grid" | "list";
const STORAGE_KEY = "flovly:boards-layout";

// Per-user wybór czy widok tablic w workspace ma być kafelkami czy listą.
// Mirror /workspaces' WorkspacesLayoutToggle. Klient: "Potrzebujemy zrobić
// to w formie kafelek". Domyślnie grid, ale toggle pozwala wrócić do listy.
export function BoardsLayoutToggle({
  grid,
  list,
}: {
  grid: ReactNode;
  list: ReactNode;
}) {
  // SSR safe: zaczynamy od grid. useEffect synchronizuje z localStorage gdy
  // dostępny.
  const [layout, setLayout] = useState<Layout>("grid");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "list" || stored === "grid") setLayout(stored);
    } catch {
      /* storage off */
    }
    setHydrated(true);
  }, []);

  const switchTo = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage off */
    }
  };

  // Render zawsze grid'em do hydratacji żeby uniknąć mismatch'a, po hydratacji
  // przełączamy.
  const showGrid = !hydrated || layout === "grid";

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex items-center justify-end">
        <div
          role="tablist"
          aria-label="Widok tablic"
          className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={showGrid}
            onClick={() => switchTo("grid")}
            title="Kafelki"
            className={`inline-flex h-7 items-center gap-1 rounded-sm px-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] transition-colors ${
              showGrid ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={11} /> kafelki
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!showGrid}
            onClick={() => switchTo("list")}
            title="Lista"
            className={`inline-flex h-7 items-center gap-1 rounded-sm px-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] transition-colors ${
              !showGrid ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={11} /> lista
          </button>
        </div>
      </div>
      {showGrid ? grid : list}
    </div>
  );
}
