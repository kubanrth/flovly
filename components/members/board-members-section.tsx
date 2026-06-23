"use client";

// Per-board membership UI — second tab of /members page.
// Renders a board picker, visibility toggle, member list, and re-uses
// the InviteForm with `defaultBoardId` so admin can invite directly to
// the selected board.

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Globe2, Trash2, UserPlus } from "lucide-react";
import {
  addBoardMemberAction,
  changeBoardRoleAction,
  removeBoardMemberAction,
  setBoardVisibilityAction,
} from "@/app/(app)/w/[workspaceId]/members/actions";
import { InviteForm } from "@/components/members/invite-form";
import type { Role, Visibility } from "@/lib/generated/prisma/enums";

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
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="font-display text-[1.05rem] font-semibold">Brak tablic</p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Utwórz pierwszą tablicę, żeby móc zarządzać jej członkami.
        </p>
      </div>
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
    <div className="flex flex-col gap-6">
      {/* Board picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow shrink-0">Tablica</span>
        <select
          value={selected.id}
          onChange={(e) => selectBoard(e.target.value)}
          className="h-9 appearance-none rounded-md border border-border bg-background px-3 font-display text-[0.9rem] font-semibold outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={flipVisibility}
          className="group/v inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          title={
            selected.visibility === "PUBLIC"
              ? "Kliknij, żeby zmienić na prywatną"
              : "Kliknij, żeby zmienić na publiczną"
          }
        >
          {selected.visibility === "PUBLIC" ? (
            <>
              <Globe2 size={12} className="text-primary" />
              Publiczna
            </>
          ) : (
            <>
              <Lock size={12} className="text-primary" />
              Prywatna
            </>
          )}
        </button>
      </div>

      <p className="text-[0.88rem] leading-[1.55] text-muted-foreground">
        {selected.visibility === "PUBLIC" ? (
          <>
            <strong className="text-foreground">Publiczna</strong> — widzą wszyscy
            członkowie workspace'a. Lista poniżej dotyczy tylko explicit
            uprawnień (np. specjalne role na tej tablicy).
          </>
        ) : (
          <>
            <strong className="text-foreground">Prywatna</strong> — widzą tylko
            członkowie z poniższej listy plus admini workspace'a. Reszta
            workspace'a NIE widzi tej tablicy w sidebarze.
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
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-[1.2rem] leading-[1.15] tracking-[-0.02em]">
          Członkowie tablicy ({members.length})
        </h3>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-[0.88rem] text-muted-foreground">
            {selected.visibility === "PUBLIC"
              ? "Brak indywidualnych członków — cały workspace ma dostęp."
              : "Brak członków. Dodaj kogoś przez formularz powyżej."}
          </div>
        ) : (
          <div className="flex flex-col border-t border-border">
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <UserPlus size={14} className="text-muted-foreground" />
        <span className="eyebrow">Dodaj istniejącego członka workspace'a</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-9 min-w-[220px] flex-1 appearance-none rounded-md border border-border bg-background px-3 text-[0.88rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name ?? c.email}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-9 appearance-none rounded-md border border-border bg-background px-3 font-mono text-[0.82rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <option value="ADMIN">ADMIN</option>
          <option value="MEMBER">MEMBER</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Dodaj
        </button>
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
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.78rem] font-bold text-white">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (name ?? email).slice(0, 2).toUpperCase()
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[0.95rem] leading-tight tracking-[-0.01em]">
          {name ?? email}
        </div>
        {name && (
          <div className="truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {email}
          </div>
        )}
      </div>
      <select
        value={role}
        onChange={(e) => changeRole(e.target.value as Role)}
        className="h-8 appearance-none rounded-md border border-border bg-background px-2 font-mono text-[0.74rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="ADMIN">ADMIN</option>
        <option value="MEMBER">MEMBER</option>
        <option value="VIEWER">VIEWER</option>
      </select>
      <button
        type="button"
        onClick={remove}
        aria-label="Usuń z tablicy"
        title="Usuń z tablicy"
        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
