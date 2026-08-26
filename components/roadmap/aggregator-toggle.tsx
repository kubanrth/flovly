"use client";

import { startTransition, useState } from "react";
import { toggleBoardAggregatorAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { Switch } from "@/components/ui/switch";

// „Tablica zbiorcza" (B6 toolbar). ON = milestone'y tej tablicy mogą agregować
// milestone'y z innych tablic w przestrzeni (Board.isAggregator + MilestoneLink).
// Optimistic — server action tylko potwierdza.
export function AggregatorToggle({
  workspaceId,
  boardId,
  initialOn,
  boardCount,
}: {
  workspaceId: string;
  boardId: string;
  initialOn: boolean;
  /** Ile tablic składa się na tę roadmapę (ta + te, z których coś zlinkowano). */
  boardCount: number;
}) {
  const [on, setOn] = useState(initialOn);
  const [pending, setPending] = useState(false);

  const submit = (next: boolean) => {
    setOn(next);
    setPending(true);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("on", next ? "true" : "false");
    startTransition(async () => {
      try {
        await toggleBoardAggregatorAction(fd);
      } catch (e) {
        setOn(!next); // rollback
        console.error("Aggregator toggle failed", e);
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <label className="ml-2 inline-flex cursor-pointer items-center gap-2">
      <Switch
        size="sm"
        checked={on}
        disabled={pending}
        onCheckedChange={(next) => submit(!!next)}
        aria-label="Tablica zbiorcza"
      />
      <span className="text-xs text-n-700">
        Tablica zbiorcza
        {/* dopełniacz po „z": 1 → tablicy, reszta → tablic */}
        {on && boardCount > 1 ? ` — milestone'y z ${boardCount} tablic` : ""}
      </span>
    </label>
  );
}
