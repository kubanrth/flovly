"use client";

import { useEffect, useState } from "react";
import { CzesiekPanel } from "./czesiek-panel";

// AK184: the floating „At" button is gone — it sat on top of view controls
// (it covered the gantt collapse-all and the whiteboard zoom-out) and the v5
// mockups have no FAB. Ateron now opens from the command palette („Zapytaj AI"),
// which dispatches `ateron:open`. This component only owns the panel.
export const ATERON_OPEN_EVENT = "ateron:open";

export function CzesiekFab({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ATERON_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ATERON_OPEN_EVENT, onOpen);
  }, []);

  // F12-K94: globals.css hides the mobile sidebar hamburger while the panel is
  // open — users read it as „close chat" and got the sidebar instead.
  useEffect(() => {
    if (open) document.body.dataset.czesiekOpen = "true";
    else delete document.body.dataset.czesiekOpen;
    return () => {
      delete document.body.dataset.czesiekOpen;
    };
  }, [open]);

  return <CzesiekPanel workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />;
}
