"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconChevronDown, IconClose } from "@/components/ui/icons";
import { Chip } from "@/components/ui/chip";
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden"
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-stretch gap-2 px-3 pt-3">
          <button
            type="button"
            onClick={() => setStagePickerOpen(true)}
            disabled={pending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium outline-none active:bg-n-100 disabled:text-n-400"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: currentStage?.colorHex ?? "var(--muted-foreground)" }}
              aria-hidden
            />
            <span className="truncate">
              {currentStage?.name ?? "Zmień stage"}
            </span>
            <IconChevronDown width={13} height={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => wonStage && moveTo(wonStage.id)}
            disabled={!wonStage || pending || currentStageId === wonStage?.id}
            aria-label="Zamknij jako wygrane"
            title={wonStage ? "Zamknij jako wygrane" : "Brak etapu typu „wygrane” w workspace"}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-success text-white outline-none active:opacity-80 disabled:bg-n-100 disabled:text-n-400"
          >
            <IconCheck width={18} height={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => lostStage && moveTo(lostStage.id)}
            disabled={!lostStage || pending || currentStageId === lostStage?.id}
            aria-label="Zamknij jako przegrane"
            title={lostStage ? "Zamknij jako przegrane" : "Brak etapu typu „przegrane” w workspace"}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-danger text-white outline-none active:opacity-80 disabled:bg-n-100 disabled:text-n-400"
          >
            <IconClose width={18} height={18} strokeWidth={2} />
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
        className="flex-1 bg-scrim"
      />
      <div
        className="sheet-mobile-surface"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <span className="sheet-drag-handle" aria-hidden />
        <h3 className="px-4 pt-3 pb-2 text-md font-semibold">Zmień etap</h3>
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {stages.map((s) => {
            const active = s.id === currentStageId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  disabled={pending || active}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none active:bg-n-100 disabled:text-n-400 data-[active=true]:bg-selected"
                  data-active={active ? "true" : "false"}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: s.colorHex }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                  {s.closedKind === "won" && <Chip hue="green" size="sm">wygrane</Chip>}
                  {s.closedKind === "lost" && <Chip hue="red" size="sm">przegrane</Chip>}
                  {active && <IconCheck width={14} height={14} className="shrink-0 text-orange-700" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
