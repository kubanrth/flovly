"use client";

import { useActionState, startTransition, useState, useEffect } from "react";
import { inviteMemberAction, type InviteState } from "@/app/(app)/w/[workspaceId]/members/actions";
import { Button } from "@/components/ui/button";
import { IconCheck, IconCopy } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

const SELECT = "h-8 rounded-sm border border-input-border bg-card px-2 text-sm outline-none hover:border-input-border-hover focus-visible:border-orange-500";

export interface InviteFormBoard {
  id: string;
  name: string;
}

export function InviteForm({
  workspaceId,
  boards,
  defaultBoardId,
}: {
  workspaceId: string;
  // When boards is non-empty the form shows a scope toggle:
  // "Cała przestrzeń" vs "Konkretna tablica" (with a select). Empty array
  // hides the toggle entirely (back to legacy workspace-only invite).
  boards?: InviteFormBoard[];
  // Pre-select a board on mount + force scope = board (used from the
  // per-board members tab).
  defaultBoardId?: string;
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteMemberAction, null);
  const [scope, setScope] = useState<"workspace" | "board">(defaultBoardId ? "board" : "workspace");
  const [boardId, setBoardId] = useState<string>(defaultBoardId ?? boards?.[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const showScopeToggle = (boards?.length ?? 0) > 0 && !defaultBoardId;

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInviteUrl(state.inviteUrl);
    }
  }, [state]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copied]);

  async function copyUrl() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      /* noop */
    }
  }

  return (
    <form
      action={(fd) => {
        setInviteUrl(null); // wyczyść poprzedni link
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {/* Pusty boardId = zakres przestrzeni; ustawiony = zakres tablicy.
          Server action rozróżnia po obecności wartości. */}
      <input type="hidden" name="boardId" value={defaultBoardId ?? (scope === "board" ? boardId : "")} />

      <h3 className="text-md font-semibold">
        {defaultBoardId ? "Zaproś osobę do tej tablicy" : "Zaproś osobę do przestrzeni"}
      </h3>

      {showScopeToggle && (
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Zakres</span>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="lg"
              aria-label="Zakres zaproszenia"
              value={scope}
              onChange={setScope}
              options={[
                { value: "workspace", label: "Cała przestrzeń" },
                { value: "board", label: "Konkretna tablica" },
              ]}
            />
            {scope === "board" && (
              <select
                aria-label="Tablica"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className={SELECT}
              >
                {(boards ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-2xs text-fg-3">
            {scope === "workspace"
              ? "Osoba dostanie dostęp do całej przestrzeni — wszystkich publicznych tablic."
              : "Osoba dostanie dostęp tylko do wybranej tablicy (nawet jeśli prywatna)."}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="np. anna@firma.pl"
            error={fieldErrors?.email}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-role">Rola</Label>
          <select id="invite-role" name="role" defaultValue="MEMBER" className={SELECT}>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Członek</option>
            <option value="VIEWER">Podgląd</option>
          </select>
        </div>

        <Button type="submit" loading={pending} disabled={pending}>
          {pending ? "Wysyłam…" : "Wyślij zaproszenie"}
        </Button>
      </div>

      {!state?.ok && state?.error && (
        <p role="alert" className="rounded-md border border-danger bg-chip-red-bg px-3 py-2 text-xs text-danger-text">
          {state.error}
        </p>
      )}

      {inviteUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-canvas p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">
              Zaproszenie {state?.ok && state.emailed ? "wysłane" : "utworzone"}
            </span>
            {state?.ok && !state.emailed && (
              <span className="text-2xs text-fg-3">(email nieskonfigurowany — skopiuj link ręcznie)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm border border-border bg-card px-2.5 py-1.5 font-mono text-xs">
              {inviteUrl}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={copyUrl}>
              {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
              {copied ? "Skopiowano" : "Kopiuj"}
            </Button>
          </div>
          <p className="text-2xs text-fg-3">Link ważny 14 dni.</p>
        </div>
      )}
    </form>
  );
}
