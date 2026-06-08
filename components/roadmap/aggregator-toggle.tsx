"use client";

import { startTransition, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toggleBoardAggregatorAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";

// F12-K58 (UI gap fill): toggle który zamienia tablicę w "główną" / agregator
// dla cross-board milestone'ów. Gdy ON, milestone'y na tej tablicy stają się
// "Poziom 2" — z dialogu edycji można podłączyć child milestone'y (Poziom 1)
// z innych tablic w workspace.
//
// Klient: "Chcę mieć jedną tablicę gdzie zintegruje wszystkie plany,
// 'milestone poziom 2' wiążę z milestone poziom 1 z tablic dzieciaków".
// Cała infra istnieje od F12-K58 (Board.isAggregator + MilestoneLink +
// linkMilestoneAction). Brakowało user-facing toggle'a.
export function AggregatorToggle({
  workspaceId,
  boardId,
  initialOn,
}: {
  workspaceId: string;
  boardId: string;
  initialOn: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  const [pending, setPending] = useState(false);

  const submit = () => {
    const next = !on;
    setOn(next); // optimistic
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
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
            on
              ? "bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Layers size={15} />
        </span>
        <div className="flex flex-col">
          <span className="eyebrow">Tablica jako agregator</span>
          <p className="text-[0.86rem] leading-[1.45] text-muted-foreground">
            Włącz żeby milestone'y tej tablicy stały się{" "}
            <strong className="text-foreground">Poziomem 2</strong> — w edycji
            milestone'a wybierzesz wtedy child'y (Poziom 1) z innych tablic w
            workspace. Idealne pod jedną „główną" tablicę zbierającą wszystkie
            plany (np. Kickback e-commerce + Kickback Cafe → Kickback Plan).
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        role="switch"
        aria-checked={on}
        title={on ? "Wyłącz agregator" : "Włącz agregator"}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          on
            ? "border-fuchsia-500/40 bg-fuchsia-500/30"
            : "border-border bg-muted"
        }`}
      >
        <span
          aria-hidden
          className={`grid h-5 w-5 place-items-center rounded-full bg-background shadow-[0_1px_2px_rgba(10,10,40,0.15)] transition-transform ${
            on ? "translate-x-6" : "translate-x-0.5"
          }`}
        >
          {pending && (
            <Loader2 size={9} className="animate-spin text-muted-foreground" />
          )}
        </span>
      </button>
    </div>
  );
}
