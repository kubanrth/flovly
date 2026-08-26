"use client";

// Per-board membership UI — second tab of /members page.
// Renders a board picker, visibility toggle, member list, and re-uses
// the InviteForm with `defaultBoardId` so admin can invite directly to
// the selected board.

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconLock, IconEye, IconTrash, IconUsers } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  addBoardMemberAction,
  changeBoardRoleAction,
  removeBoardMemberAction,
  setBoardVisibilityAction,
} from "@/app/(app)/w/[workspaceId]/members/actions";
import { InviteForm } from "@/components/members/invite-form";
import type { Role, Visibility } from "@/lib/generated/prisma/enums";

const SELECT = "h-8 rounded-sm border border-input-border bg-card px-2 text-sm outline-none hover:border-input-border-hover focus-visible:border-orange-500";

export interface BoardSummary {
  id: string;
  name: string;
  visibility: Visibility;
}

export interface BoardMember {
  id: string; // BoardMembership.id
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: Role;
}

export interface WorkspaceMember {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export function BoardMembersSection({
  workspaceId,
  boards,
  selected,
  members,
  workspaceMembers,
}: {
  workspaceId: string;
  boards: BoardSummary[];
  selected: BoardSummary | null;
  members: BoardMember[];
  workspaceMembers: WorkspaceMember[];
}) {
  const router = useRouter();
  if (!selected) {
    return (
      <EmptyState
        title="Brak tablic"
        description="Utwórz pierwszą tablicę, żeby móc zarządzać jej członkami."
      />
    );
  }

  const selectBoard = (boardId: string) => {
    router.push(`/w/${workspaceId}/members?tab=boards&board=${boardId}`);
  };

  const flipVisibility = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", selected.id);
    fd.set("visibility", selected.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC");
    startTransition(async () => {
      await setBoardVisibilityAction(fd);
      router.refresh();
    });
  };

  // Workspace members not yet on this board — picker source for the
  // "+ dodaj istniejącego członka" affordance.
  const onBoardUserIds = new Set(members.map((m) => m.userId));
  const addable = workspaceMembers.filter((m) => !onBoardUserIds.has(m.userId));

  return (
    <div className="flex flex-col gap-3">
      {/* Board picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow shrink-0">Tablica</span>
        <select
          aria-label="Tablica"
          value={selected.id}
          onChange={(e) => selectBoard(e.target.value)}
          className={SELECT}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="ml-auto" />
        <Button
          type="button"
          variant="secondary"
          onClick={flipVisibility}
          title={
            selected.visibility === "PUBLIC"
              ? "Kliknij, żeby zmienić na prywatną"
              : "Kliknij, żeby zmienić na publiczną"
          }
        >
          {selected.visibility === "PUBLIC" ? (
            <>
              <IconEye width={13} height={13} />
              Publiczna
            </>
          ) : (
            <>
              <IconLock width={13} height={13} />
              Prywatna
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-fg-2">
        {selected.visibility === "PUBLIC" ? (
          <>
            <strong className="font-medium text-foreground">Publiczna</strong> — widzą wszyscy
            członkowie przestrzeni. Lista poniżej dotyczy tylko wyraźnych uprawnień (np. innej
            roli na tej tablicy).
          </>
        ) : (
          <>
            <strong className="font-medium text-foreground">Prywatna</strong> — widzą tylko
            osoby z poniższej listy plus admini przestrzeni. Reszta nie widzi tej tablicy
            w pasku bocznym.
          </>
        )}
      </p>

      {/* Email invite to this board */}
      <InviteForm workspaceId={workspaceId} defaultBoardId={selected.id} />

      {/* Add existing workspace member (no email round-trip) */}
      {addable.length > 0 && (
        <AddExistingMember
          workspaceId={workspaceId}
          boardId={selected.id}
          candidates={addable}
        />
      )}

      {/* Member list */}
      <section className="flex flex-col gap-2">
        <span className="eyebrow">Członkowie tablicy ({members.length})</span>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
            {selected.visibility === "PUBLIC"
              ? "Brak indywidualnych członków — cała przestrzeń ma dostęp."
              : "Brak członków. Dodaj kogoś przez formularz powyżej."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {members.map((m) => (
              <BoardMemberRow
                key={m.id}
                workspaceId={workspaceId}
                membershipId={m.id}
                name={m.name}
                email={m.email}
                avatarUrl={m.avatarUrl}
                role={m.role}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddExistingMember({
  workspaceId,
  boardId,
  candidates,
}: {
  workspaceId: string;
  boardId: string;
  candidates: WorkspaceMember[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>(candidates[0]?.userId ?? "");
  const [role, setRole] = useState<Role>("MEMBER");

  const submit = () => {
    if (!userId) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("userId", userId);
    fd.set("role", role);
    startTransition(async () => {
      await addBoardMemberAction(fd);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <IconUsers width={14} height={14} className="text-n-500" />
        <span className="eyebrow">Dodaj istniejącego członka przestrzeni</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Osoba"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className={`${SELECT} min-w-[220px] flex-1`}
        >
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name ?? c.email}
            </option>
          ))}
        </select>
        <select
          aria-label="Rola"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={SELECT}
        >
          <option value="ADMIN">Admin</option>
          <option value="MEMBER">Członek</option>
          <option value="VIEWER">Podgląd</option>
        </select>
        <Button type="button" onClick={submit}>
          Dodaj
        </Button>
      </div>
    </div>
  );
}

function BoardMemberRow({
  workspaceId,
  membershipId,
  name,
  email,
  avatarUrl,
  role,
}: {
  workspaceId: string;
  membershipId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: Role;
}) {
  const router = useRouter();
  const changeRole = (next: Role) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("membershipId", membershipId);
    fd.set("role", next);
    startTransition(async () => {
      await changeBoardRoleAction(fd);
      router.refresh();
    });
  };
  const remove = () => {
    if (!confirm(`Usunąć ${name ?? email} z tej tablicy?`)) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("membershipId", membershipId);
    startTransition(async () => {
      await removeBoardMemberAction(fd);
      router.refresh();
    });
  };
  return (
    <div className="flex min-h-11 items-center gap-2.5 border-b border-n-100 bg-card px-3.5 py-1.5 last:border-b-0">
      <Avatar name={name ?? email} src={avatarUrl} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name ?? email}</div>
        {name && <div className="truncate font-mono text-2xs text-fg-3">{email}</div>}
      </div>
      <select
        aria-label={`Rola: ${name ?? email}`}
        value={role}
        onChange={(e) => changeRole(e.target.value as Role)}
        className={SELECT}
      >
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Członek</option>
        <option value="VIEWER">Podgląd</option>
      </select>
      <Button
        type="button"
        variant="ghost"
        size="md"
        iconOnly
        onClick={remove}
        aria-label="Usuń z tablicy"
        title="Usuń z tablicy"
        className="hover:text-danger-text"
      >
        <IconTrash width={14} height={14} />
      </Button>
    </div>
  );
}
