"use client";

import { useActionState, startTransition, useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import {
  inviteMemberAction,
  type InviteState,
} from "@/app/(app)/w/[workspaceId]/members/actions";

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
  // "Cały workspace" vs "Konkretna tablica" (with a select). Empty array
  // hides the toggle entirely (back to legacy workspace-only invite).
  boards?: InviteFormBoard[];
  // Pre-select a board on mount + force scope = board (used from the
  // per-board members tab).
  defaultBoardId?: string;
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMemberAction,
    null,
  );
  const [scope, setScope] = useState<"workspace" | "board">(
    defaultBoardId ? "board" : "workspace",
  );
  const [boardId, setBoardId] = useState<string>(
    defaultBoardId ?? boards?.[0]?.id ?? "",
  );
  const [copied, setCopied] = useState(false);
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const showScopeToggle = (boards?.length ?? 0) > 0 && !defaultBoardId;

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copied]);

  async function copyUrl() {
    if (!state?.ok) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
    } catch {
      /* noop */
    }
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(46,19,52,0.08)]"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {/* Empty boardId = workspace scope; set value = board scope. The
          server action distinguishes by presence. */}
      <input
        type="hidden"
        name="boardId"
        value={defaultBoardId ?? (scope === "board" ? boardId : "")}
      />

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Nowe zaproszenie</span>
        <h3 className="font-display text-[1.2rem] font-bold leading-[1.2] tracking-[-0.02em]">
          {defaultBoardId
            ? "Zaproś osobę do tej tablicy"
            : "Zaproś osobę do przestrzeni"}
        </h3>
      </div>

      {showScopeToggle && (
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Zakres</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScope("workspace")}
              data-active={scope === "workspace"}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              Cały workspace
            </button>
            <button
              type="button"
              onClick={() => setScope("board")}
              data-active={scope === "board"}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              Konkretna tablica
            </button>
            {scope === "board" && (
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="h-9 appearance-none rounded-md border border-border bg-background px-3 font-mono text-[0.82rem] outline-none focus:border-primary"
              >
                {(boards ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            {scope === "workspace"
              ? "Osoba dostanie dostęp do całego workspace'a — wszystkich publicznych tablic."
              : "Osoba dostanie dostęp tylko do wybranej tablicy (nawet jeśli prywatna)."}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_140px_auto]">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="np. anna@firma.pl"
            aria-invalid={!!fieldErrors?.email}
            className="h-10 border-b border-border bg-transparent pb-1 text-[0.95rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
          />
          {fieldErrors?.email && (
            <span className="font-mono text-[0.66rem] text-destructive">
              {fieldErrors.email}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Rola</span>
          <select
            name="role"
            defaultValue="MEMBER"
            className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.9rem] outline-none focus:border-primary"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {pending ? "Wysyłam…" : "Wyślij zaproszenie"}
          </button>
        </div>
      </div>

      {!state?.ok && state?.error && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-primary">
              Zaproszenie {state.emailed ? "wysłane" : "utworzone"}
            </span>
            {!state.emailed && (
              <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                (email nie skonfigurowany — skopiuj link ręcznie)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-[0.82rem]">
              {state.inviteUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {/* key = remount na zmianę stanu → animowany swap ikonki
                  (fade + zoom, recepta na contextual icon transitions) */}
              <span
                key={copied ? "check" : "copy"}
                className="inline-flex animate-in fade-in zoom-in-50 duration-200"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </span>
              {copied ? "Skopiowano" : "Kopiuj"}
            </button>
          </div>
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
            Link ważny 14 dni.
          </p>
        </div>
      )}
    </form>
  );
}
