"use client";

import { useState } from "react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  changeRoleAction,
  removeMemberAction,
} from "@/app/(app)/w/[workspaceId]/members/actions";

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

  const initials = (name ?? email).slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.78rem] font-bold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={36} height={36} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em]">
            {name ?? email.split("@")[0]}
            {isSelf && (
              <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                ty
              </span>
            )}
            {isOwner && (
              <span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-primary">
                właściciel
              </span>
            )}
          </div>
          <div className="truncate font-mono text-[0.72rem] text-muted-foreground">
            {email}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {canManage && !isOwner ? (
          <form action={changeRoleAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <select
              name="role"
              defaultValue={role}
              onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
              className="h-8 border border-border bg-transparent px-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </form>
        ) : (
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
            {role.toLowerCase()}
          </span>
        )}

        {canRemove && !isOwner && !isSelf && (
          confirm ? (
            <form action={removeMemberAction} className="flex items-center gap-2">
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="membershipId" value={membershipId} />
              <button
                type="submit"
                className="h-8 bg-destructive px-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              >
                potwierdź
              </button>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
              >
                anuluj
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
            >
              usuń
            </button>
          )
        )}
      </div>
    </div>
  );
}
