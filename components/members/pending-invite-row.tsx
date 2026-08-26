"use client";

import { useState, useEffect } from "react";
import { cancelInviteAction } from "@/app/(app)/w/[workspaceId]/members/actions";
import { Button } from "@/components/ui/button";
import { IconCheck, IconCopy } from "@/components/ui/icons";

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
    // eslint-disable-next-line react-hooks/purity
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
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-n-100 bg-card px-3.5 py-1.5 last:border-b-0 max-md:flex-wrap">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{email}</span>
        <span className="truncate text-2xs text-fg-3">
          {role.toLowerCase()}
          {boardName && <> · tablica {boardName}</>} · wygasa za {daysLeft} dni
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="secondary" size="sm" onClick={copyUrl}>
          {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
          {copied ? "Skopiowano" : "Kopiuj link"}
        </Button>
        <form action={cancelInviteAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" variant="ghost" size="sm" className="text-danger-text">
            Anuluj
          </Button>
        </form>
      </div>
    </div>
  );
}
