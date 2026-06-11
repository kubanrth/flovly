"use client";

import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { cancelInviteAction } from "@/app/(app)/w/[workspaceId]/members/actions";

export function PendingInviteRow({
  workspaceId,
  invitationId,
  email,
  role,
  inviteUrl,
  expiresAt,
  boardName,
}: {
  workspaceId: string;
  invitationId: string;
  email: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
  // When set, this is a board-scope invite — show the board
  // name instead of just the role so admin sees what they invited to.
  boardName?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const daysLeft = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[0.95rem] font-display leading-tight tracking-[-0.01em]">
          {email}
        </span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {role.toLowerCase()}
          {boardName && (
            <>
              {" "}· tablica{" "}
              <span className="text-primary">{boardName}</span>
            </>
          )}{" "}
          · wygasa za {daysLeft} dni
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyUrl}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <span
            key={copied ? "check" : "copy"}
            className="inline-flex animate-in fade-in zoom-in-50 duration-200"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </span>
          {copied ? "skopiowano" : "kopiuj link"}
        </button>
        <form action={cancelInviteAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="invitationId" value={invitationId} />
          <button
            type="submit"
            className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
          >
            anuluj
          </button>
        </form>
      </div>
    </div>
  );
}
