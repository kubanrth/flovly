"use client";

// Wiersz flagi systemowej na /admin/flags.
//
// Zapis od razu po przełączeniu (bez przycisku „Zapisz"). Flaga destrukcyjna
// (`kill_switch_writes`) wymaga potwierdzenia przy WŁĄCZANIU — blokuje wszystkie
// zapisy w aplikacji; wyłączenie zostaje jednoklikowe, żeby zdjęcie blokady
// w trakcie incydentu było natychmiastowe.

import { startTransition, useState } from "react";
import { updateSystemFlagAction } from "@/app/(admin)/admin/flags/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconCheck, IconClose, IconWarning } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
  // Stan optymistyczny — cofa się, gdy serwer odmówi.
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
      setTimeout(() => setSaveState("idle"), 1400);
    });
  };

  const onToggle = () => {
    if (flag.destructive && !checked) {
      setConfirmOpen(true);
      return;
    }
    commit(!checked);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-border bg-card p-3",
          flag.destructive && "border-chip-red-fg/30",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <code className="truncate font-mono text-xs font-semibold">{flag.key}</code>
            {flag.destructive && (
              <Chip hue="red" size="sm">destrukcyjna</Chip>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{flag.description}</p>
          {(flag.lastChangedAt || flag.lastChangedBy) && (
            <p className="font-mono text-2xs text-fg-3">
              ostatnio:{" "}
              {flag.lastChangedBy
                ? (flag.lastChangedBy.name ?? flag.lastChangedBy.email.split("@")[0])
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
          {error && <p className="text-xs text-danger-text">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <Switch
            checked={checked}
            disabled={saveState === "saving"}
            onCheckedChange={onToggle}
            aria-label={flag.label}
          />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Włączyć kill switch?</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-chip-red-bg text-danger-text" aria-hidden>
              <IconWarning width={16} height={16} />
            </span>
            <p className="text-sm text-muted-foreground">
              Flaga <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-xs">{flag.key}</code>{" "}
              zablokuje wszystkie operacje zapisu w aplikacji dla każdego użytkownika. Wyłączyć
              będzie ją można tylko z tego ekranu. Włączaj wyłącznie w reakcji na incydent.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Anuluj
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                commit(true);
              }}
            >
              <IconWarning width={14} height={14} /> Włącz kill switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <Spinner className="text-muted-foreground" />;
  if (state === "saved") return <IconCheck width={13} height={13} className="text-success-text" aria-label="Zapisano" />;
  if (state === "error") return <IconClose width={13} height={13} className="text-danger-text" aria-label="Błąd zapisu" />;
  return null;
}
