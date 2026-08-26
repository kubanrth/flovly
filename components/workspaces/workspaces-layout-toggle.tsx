"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/segmented";

const STORAGE_KEY = "danielos.workspaces.layout";

export type WorkspacesLayout = "grid" | "list";

// Thin client wrapper that toggles between the two pre-rendered views
// supplied as children. Keeps all data-fetching on the server. User
// preference persists in localStorage across sessions.
export function WorkspacesLayoutToggle({ grid, list }: { grid: ReactNode; list: ReactNode }) {
  // Initialize directly from localStorage so we don't need a post-mount
  // setState (which causes an extra render and a visible flash).
  const [layout, setLayout] = useState<WorkspacesLayout>(() => {
    if (typeof window === "undefined") return "grid";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "list" || stored === "grid" ? stored : "grid";
    } catch {
      return "grid";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      /* noop */
    }
  }, [layout]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Widok</span>
        <Segmented
          size="md"
          aria-label="Układ listy przestrzeni"
          value={layout}
          onChange={setLayout}
          options={[
            { value: "grid", label: "Kafelki" },
            { value: "list", label: "Lista" },
          ]}
        />
      </div>
      {layout === "grid" ? grid : list}
    </div>
  );
}
