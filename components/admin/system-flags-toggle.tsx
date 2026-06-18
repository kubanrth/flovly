"use client";

// Per-row client toggle for /admin/flags.
//
// Autosave on flip — UX matches the rest of the admin panel (no "Save" buttons
// for single-field toggles). The destructive flag (`kill_switch_writes`)
// shows a confirm dialog before turning ON, because flipping it blocks all
// app writes globally and lacks a graceful rollback flow.

import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { startTransition, useState } from "react";
import { updateSystemFlagAction } from "@/app/(admin)/admin/flags/actions";

interface FlagRow {
  key: string;
  label: string;
  description: string;
  destructive: boolean;
  value: boolean;
  lastChangedAt: string | null;
  lastChangedBy: { name: string | null; email: string } | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SystemFlagsToggle({ flag }: { flag: FlagRow }) {
  // Optimistic local state — flips immediately so the user sees feedback.
  // Reverts on server error.
  const [checked, setChecked] = useState(flag.value);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: boolean) => {
    setError(null);
    const previous = checked;
    setChecked(next);
    setSaveState("saving");
    startTransition(async () => {
      const res = await updateSystemFlagAction(flag.key, next);
      if (!res.ok) {
        setChecked(previous);
        setSaveState("error");
        setError(res.error ?? "Nie udało się zapisać.");
        return;
      }
      setSaveState("saved");
      // Fade the "saved" indicator after a beat so it doesn't linger.
      setTimeout(() => setSaveState("idle"), 1400);
    });
  };

  const onToggle = () => {
    // Destructive flag — flipping ON requires confirmation. Flipping OFF
    // (recovery) is intentionally one-click so admins can lift a kill switch
    // fast in incident response.
    if (flag.destructive && !checked) {
      setConfirmOpen(true);
      return;
    }
    commit(!checked);
  };

  return (
    <>
      <div
        data-destructive={flag.destructive ? "true" : "false"}
        className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-border/80 data-[destructive=true]:border-destructive/30"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <code className="truncate font-mono text-[0.78rem] font-semibold text-foreground">
              {flag.key}
            </code>
            {flag.destructive && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/12 px-1.5 py-0.5 font-mono text-[0.56rem] font-bold uppercase tracking-[0.14em] text-destructive">
                <AlertTriangle size={9} /> destrukt.
              </span>
            )}
          </div>
          <p className="text-[0.8rem] text-muted-foreground">{flag.description}</p>
          {(flag.lastChangedAt || flag.lastChangedBy) && (
            <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
              ostatnio:{" "}
              {flag.lastChangedBy
                ? flag.lastChangedBy.name ?? flag.lastChangedBy.email.split("@")[0]
                : "—"}
              {flag.lastChangedAt && (
                <>
                  {" · "}
                  {new Date(flag.lastChangedAt).toLocaleString("pl-PL", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </p>
          )}
          {error && (
            <p className="mt-1 text-[0.72rem] text-destructive">{error}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <Toggle
            checked={checked}
            disabled={saveState === "saving"}
            onChange={onToggle}
            destructive={flag.destructive}
            label={flag.label}
          />
        </div>
      </div>

      {confirmOpen && (
        <ConfirmKillSwitch
          flagKey={flag.key}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            commit(true);
          }}
        />
      )}
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return <Loader2 size={13} className="animate-spin text-muted-foreground" />;
  if (state === "saved")
    return <Check size={13} className="text-emerald-500" aria-label="Zapisano" />;
  if (state === "error")
    return <X size={13} className="text-destructive" aria-label="Błąd zapisu" />;
  return null;
}

// Inline switch primitive — we don't have shadcn/ui Switch yet and adding the
// full Radix dep just for this row would be overkill. Track grows pill-style,
// knob slides via translate-x (transform-only animation — guardrail).
function Toggle({
  checked,
  disabled,
  onChange,
  destructive,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  destructive?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      data-checked={checked ? "true" : "false"}
      data-destructive={destructive ? "true" : "false"}
      className="group relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full border border-border bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 data-[checked=true]:bg-brand-gradient data-[checked=true]:data-[destructive=true]:bg-[linear-gradient(135deg,#F43F5E,#E1318F)] data-[checked=true]:border-transparent"
    >
      <span
        aria-hidden
        className="absolute left-[2px] inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[checked=true]:translate-x-[18px]"
      />
    </button>
  );
}

// Confirm dialog for `kill_switch_writes`. Inline modal pattern matches
// ResetPasswordDialog (no shadcn Dialog wrapper needed; consistent w/ codebase).
function ConfirmKillSwitch({
  flagKey,
  onCancel,
  onConfirm,
}: {
  flagKey: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="relative flex w-[min(440px,100%)] flex-col gap-4 rounded-2xl border border-destructive/40 bg-card p-6 shadow-[0_24px_48px_-12px_rgba(244,63,94,0.25)]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-destructive/12 text-destructive">
            <AlertTriangle size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[1.05rem] font-bold leading-tight tracking-[-0.01em]">
              Włączyć kill switch?
            </h2>
            <p className="text-[0.82rem] text-muted-foreground">
              Flaga{" "}
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.74rem]">
                {flagKey}
              </code>{" "}
              zablokuje wszystkie operacje zapisu w aplikacji dla każdego user&apos;a.
              Tylko Ty będziesz mógł ją wyłączyć z tego ekranu. Włączaj wyłącznie
              jako reakcję na incydent.
            </p>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-3 font-sans text-[0.85rem] font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
          >
            <AlertTriangle size={13} /> Włącz kill switch
          </button>
        </div>
      </div>
    </div>
  );
}
