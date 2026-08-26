"use client";

import { useState } from "react";
import type { Role } from "@/lib/generated/prisma/enums";
import { changeRoleAction, removeMemberAction } from "@/app/(app)/w/[workspaceId]/members/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";

export function MemberRow({
  workspaceId,
  membershipId,
  name,
  email,
  avatarUrl,
  role,
  isSelf,
  isOwner,
  canManage,
  canRemove,
}: {
  workspaceId: string;
  membershipId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: Role;
  isSelf: boolean;
  isOwner: boolean;
  canManage: boolean;
  canRemove: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const display = name ?? email.split("@")[0] ?? email;

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-n-100 bg-card px-3.5 py-1.5 last:border-b-0 max-md:flex-wrap">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={display} src={avatarUrl} size={28} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{display}</span>
            {isSelf && <span className="text-2xs text-fg-3">ty</span>}
            {isOwner && <Chip hue="orange" size="sm">właściciel</Chip>}
          </div>
          <div className="truncate font-mono text-2xs text-fg-3">{email}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManage && !isOwner ? (
          <form action={changeRoleAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <select
              name="role"
              aria-label={`Rola: ${display}`}
              defaultValue={role}
              onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
              className="h-8 rounded-sm border border-input-border bg-card px-2 text-xs outline-none hover:border-input-border-hover focus-visible:border-orange-500"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Członek</option>
              <option value="VIEWER">Podgląd</option>
            </select>
          </form>
        ) : (
          <span className="text-2xs text-fg-3">{role.toLowerCase()}</span>
        )}

        {canRemove &&
          !isOwner &&
          !isSelf &&
          (confirm ? (
            <form action={removeMemberAction} className="flex items-center gap-1.5">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="membershipId" value={membershipId} />
              <Button type="submit" variant="danger" size="sm">
                Potwierdź
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Anuluj
              </Button>
            </form>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)} className="text-danger-text">
              Usuń
            </Button>
          ))}
      </div>
    </div>
  );
}
