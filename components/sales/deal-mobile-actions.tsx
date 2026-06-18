"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, X } from "lucide-react";
import { moveDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";

/**
 * B6 CRM mobile · Deal card sticky bottom actions
 *
 * Spec: "Action buttons sticky bottom (Zmień stage + Zamknij wygrane/przegrane)"
 *
 * Render:
 * - sticky pasek na dole viewport'u (`fixed bottom-0` na mobile, hidden md:)
 * - 3 akcje: Zmień stage (otwiera bottom sheet z listą), Wygrane (green),
 *   Przegrane (red)
 * - safe-area-inset-bottom padding dla iPhone'ów z notch'em
 *
 * Akcje używają istniejącego `moveDealAction` (FormData z workspaceId, dealId,
 * stageId, rowOrder=1) — nie tworzymy nowych server actions.
 *
 * Won/lost stage'e: filtrujemy `stages` po `closedKind === "won" | "lost"`.
 * Jeśli workspace nie ma takiego stage'a → przycisk disabled z tooltip'em.
 */
export function DealMobileActions({
  workspaceId,
  dealId,
  currentStageId,
  stages,
}: {
  workspaceId: string;
  dealId: string;
  currentStageId: string;
  stages: { id: string; name: string; colorHex: string; closedKind: "won" | "lost" | null }[];
}) {
  const router = useRouter();
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const wonStage = stages.find((s) => s.closedKind === "won");
  const lostStage = stages.find((s) => s.closedKind === "lost");
  const currentStage = stages.find((s) => s.id === currentStageId);

  const moveTo = (stageId: string) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("dealId", dealId);
    fd.set("stageId", stageId);
    // rowOrder = 1 → ląduje na początku targetu. Server zaakceptuje, a kanban
    // i tak normalizuje order'y po deletecie/swap'ie. Brak konfliktu z drag'em
    // bo to mobile flow.
    fd.set("rowOrder", "1");
    startTransition(async () => {
      await moveDealAction(fd);
      router.refresh();
    });
    setStagePickerOpen(false);
  };

  return (
    <>
      {/* Spacer żeby content nie chowal się pod paskiem (h-20 ≈ 56px button +
          16px padding). Hidden na desktop. */}
      <div aria-hidden className="h-20 md:hidden" />

      <div
        // safe-area-inset-bottom (iPhone) — content row dostaje 12px padding
        // + dodatkowy env padding pod nim. Z-index 30 nad standardowym
        // contentem, pod stagepicker overlay'em (z-40).
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-stretch gap-2 px-3 pt-3">
          <button
            type="button"
            onClick={() => setStagePickerOpen(true)}
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-3 text-[0.86rem] font-semibold transition-colors active:bg-accent disabled:opacity-60"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: currentStage?.colorHex ?? "var(--muted-foreground)" }}
              aria-hidden
            />
            <span className="truncate">
              {currentStage?.name ?? "Zmień stage"}
            </span>
            <ChevronDown size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => wonStage && moveTo(wonStage.id)}
            disabled={!wonStage || pending || currentStageId === wonStage?.id}
            aria-label="Zamknij jako wygrane"
            title={wonStage ? "Zamknij jako wygrane" : "Brak etapu typu „wygrane” w workspace"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm transition-opacity active:opacity-80 disabled:opacity-40"
          >
            <Check size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => lostStage && moveTo(lostStage.id)}
            disabled={!lostStage || pending || currentStageId === lostStage?.id}
            aria-label="Zamknij jako przegrane"
            title={lostStage ? "Zamknij jako przegrane" : "Brak etapu typu „przegrane” w workspace"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-rose-500 text-white shadow-sm transition-opacity active:opacity-80 disabled:opacity-40"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {stagePickerOpen && (
        <StagePickerSheet
          stages={stages}
          currentStageId={currentStageId}
          onPick={moveTo}
          onClose={() => setStagePickerOpen(false)}
          pending={pending}
        />
      )}
    </>
  );
}

function StagePickerSheet({
  stages,
  currentStageId,
  onPick,
  onClose,
  pending,
}: {
  stages: { id: string; name: string; colorHex: string; closedKind: "won" | "lost" | null }[];
  currentStageId: string;
  onPick: (stageId: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Wybierz etap"
    >
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm"
      />
      <div
        className="rounded-t-2xl border-t border-border bg-popover shadow-[0_-20px_40px_-12px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
        </div>
        <h3 className="px-4 pt-3 pb-2 font-display text-[1rem] font-semibold">
          Zmień etap
        </h3>
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {stages.map((s) => {
            const active = s.id === currentStageId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  disabled={pending || active}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors active:bg-accent disabled:opacity-60 data-[active=true]:bg-accent/60"
                  data-active={active ? "true" : "false"}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: s.colorHex }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-[0.94rem] font-medium">
                    {s.name}
                  </span>
                  {s.closedKind === "won" && (
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                      wygrane
                    </span>
                  )}
                  {s.closedKind === "lost" && (
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">
                      przegrane
                    </span>
                  )}
                  {active && (
                    <Check size={14} className="shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
