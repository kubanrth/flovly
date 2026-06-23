"use client";

// Client wrapper for /admin/users bulk operations.
//
// Pattern: parent server component renders the full <table> markup so first
// paint is fast + SEO-static; this client component owns:
//   1. `selectedIds: Set<string>` (selection state — lifted via context)
//   2. The sticky-bottom "Bulk action bar" that appears when ≥1 row picked
//
// We deliberately do NOT hydrate the entire users list as a client island —
// only the checkboxes (small + dependency-light) and the action bar live here.

import {
  Ban,
  Check,
  ChevronsRight,
  KeyRound,
  Loader2,
  Shield,
  ShieldOff,
  UserCheck,
  X,
} from "lucide-react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  bulkSetSuperAdminAction,
  bulkToggleBanAction,
} from "@/app/(admin)/admin/actions";
import {
  bulkUserActionResultZero,
  type BulkActionResult,
} from "@/app/(admin)/admin/types";

interface SelectionContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  allIds: string[];
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function UsersSelectionProvider({
  allIds,
  children,
}: {
  allIds: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      // If everything is already selected → clear. Otherwise select-all.
      const allChecked = ids.every((id) => prev.has(id));
      if (allChecked) return new Set();
      return new Set(ids);
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const ctx = useMemo<SelectionContextValue>(
    () => ({ selected, toggle, toggleAll, clear, allIds }),
    [selected, toggle, toggleAll, clear, allIds],
  );

  return <SelectionContext.Provider value={ctx}>{children}</SelectionContext.Provider>;
}

function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within UsersSelectionProvider");
  return ctx;
}

// Header checkbox — indeterminate when partial, checked when all rows on this
// page are selected.
export function UsersSelectAllCheckbox() {
  const { selected, toggleAll, allIds } = useSelection();
  const selectedOnPage = allIds.filter((id) => selected.has(id)).length;
  const checked = selectedOnPage > 0 && selectedOnPage === allIds.length;
  const indeterminate = selectedOnPage > 0 && selectedOnPage < allIds.length;
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      onChange={() => toggleAll(allIds)}
      ariaLabel="Zaznacz wszystkich na stronie"
      size="sm"
    />
  );
}

// Row checkbox — disabled for self (admin can't bulk-act on themselves).
export function UsersRowCheckbox({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) {
  const { selected, toggle } = useSelection();
  return (
    <Checkbox
      checked={selected.has(id)}
      disabled={disabled}
      onChange={() => toggle(id)}
      ariaLabel="Zaznacz wiersz"
      size="sm"
    />
  );
}

// Floating sticky bar at the bottom of the viewport. Renders only when ≥1 row
// is selected. Uses a glass background to match the design spec's bulk toolbar.
export function UsersBulkBar() {
  const { selected, clear } = useSelection();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BulkActionResult | null>(null);

  if (selected.size === 0) return null;

  const ids = Array.from(selected);

  const run = (
    action: (ids: string[]) => Promise<BulkActionResult>,
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setPending(true);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await action(ids);
        setResult(res);
        if (res.ok && res.affected > 0) {
          // Drop selection on success so the user gets visual confirmation that
          // the bar dismisses + their list re-renders fresh.
          clear();
        }
      } catch (err) {
        console.error("Bulk action failed:", err);
        setResult({ ok: false, affected: 0, error: "Nie udało się wykonać operacji." });
      } finally {
        setPending(false);
      }
    });
  };

  return (
    // z-[50] === Z.fab (F12-K104) — floating bulk-action bar.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex justify-center px-4 pb-4 md:pb-6">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-[min(720px,100%)] flex-wrap items-center gap-2 rounded-2xl border border-white/14 bg-card/95 px-3 py-2 shadow-[0_18px_40px_-16px_rgba(10,10,40,0.6)] backdrop-blur-xl md:gap-3 md:px-4 md:py-2.5"
      >
        <span className="inline-flex items-center gap-2 rounded-md bg-brand-gradient px-2 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white">
          {selected.size}{" "}
          <span className="font-sans normal-case tracking-normal">zaznaczono</span>
        </span>

        <Divider />

        <BulkButton
          icon={<Ban size={13} />}
          label="Zawieś"
          tone="warning"
          disabled={pending}
          onClick={() =>
            run(
              (ids) => bulkToggleBanAction(ids, true),
              `Zbanować ${selected.size} kont? Wyloguje aktywne sesje.`,
            )
          }
        />
        <BulkButton
          icon={<UserCheck size={13} />}
          label="Odbanuj"
          disabled={pending}
          onClick={() => run((ids) => bulkToggleBanAction(ids, false))}
        />

        <Divider />

        <BulkButton
          icon={<Shield size={13} />}
          label="Nadaj admina"
          disabled={pending}
          onClick={() =>
            run(
              (ids) => bulkSetSuperAdminAction(ids, true),
              `Nadać ${selected.size} userom rolę Super Admin?`,
            )
          }
        />
        <BulkButton
          icon={<ShieldOff size={13} />}
          label="Odbierz admina"
          disabled={pending}
          onClick={() => run((ids) => bulkSetSuperAdminAction(ids, false))}
        />

        <Divider />

        <BulkButton
          icon={<KeyRound size={13} />}
          label="Reset hasła"
          tone="muted"
          disabled
          title="Reset bulk — przekaż listę userom indywidualnie."
          onClick={() => {
            /* placeholder — bulk password reset has no out-of-band delivery
               channel yet; per-row dialog is the canonical flow. */
          }}
        />

        <Divider />

        {pending && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        {result && !pending && (
          <span
            data-tone={result.ok ? "ok" : "err"}
            className="inline-flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] data-[tone=err]:text-destructive data-[tone=ok]:text-emerald-500"
          >
            {result.ok ? (
              <>
                <Check size={11} /> {result.affected} ok
              </>
            ) : (
              <>
                <X size={11} /> błąd
              </>
            )}
          </span>
        )}

        <button
          type="button"
          onClick={clear}
          aria-label="Wyczyść zaznaczenie"
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-5 w-px bg-border" />;
}

function BulkButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "default",
  title,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "warning" | "muted";
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-tone={tone}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.78rem] text-foreground transition-colors hover:bg-accent data-[tone=warning]:text-amber-500 data-[tone=muted]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

// Note: bulkUserActionResultZero importujesz teraz bezpośrednio z @/app/(admin)/admin/types
// (został wyciągnięty z actions.ts żeby spełnić Next.js 16 "use server" rule).
// Used to gesture toward the bottom bar from the bulk-checked count UI.
export const BulkBarArrow = ChevronsRight;
