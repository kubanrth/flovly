import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { InviteForm } from "@/components/members/invite-form";
import { MemberRow } from "@/components/members/member-row";
import { PendingInviteRow } from "@/components/members/pending-invite-row";
import { BoardMembersSection } from "@/components/members/board-members-section";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string; board?: string }>;
}) {
  const { workspaceId } = await params;
  const { tab, board: selectedBoardId } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, ownerId: true, name: true },
  });
  if (!workspace) notFound();

  // Tab visibility for non-admins is hidden below; we still load boards here.
  const [memberships, invitations, boards] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    db.invitation.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { board: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.board.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, visibility: true },
    }),
  ]);

  const canManage = can(ctx.role, "workspace.changeRole");
  const canRemove = can(ctx.role, "workspace.removeMember");
  const canInvite = can(ctx.role, "workspace.inviteMember");
  const canManageBoardMembers = can(ctx.role, "board.manageMembers");

  const origin =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3100";

  const activeTab: "workspace" | "boards" =
    tab === "boards" && canManageBoardMembers ? "boards" : "workspace";

  // Default selected board = first one in the list.
  const selectedBoard =
    activeTab === "boards"
      ? boards.find((b) => b.id === selectedBoardId) ?? boards[0] ?? null
      : null;

  // Per-board membership; only runs when boards tab is open.
  const boardMembers = selectedBoard
    ? await db.boardMembership.findMany({
        where: { boardId: selectedBoard.id },
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true } },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      })
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 md:gap-10">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Członkowie</span>
        <h2 className="font-display text-[1.4rem] leading-[1.1] tracking-[-0.02em] md:text-[1.8rem]">
          Kto pracuje w tej przestrzeni
        </h2>
        <p className="text-[0.88rem] leading-[1.5] text-muted-foreground md:text-[0.92rem] md:leading-[1.55]">
          Admini mogą zapraszać do całego workspace'a albo do konkretnej
          tablicy. Tablica może być publiczna (wszyscy widzą) lub prywatna
          (tylko wyraźnie dodani).
        </p>
      </div>

      {canManageBoardMembers && (
        <nav className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
          <TabLink href={`/w/${workspaceId}/members`} active={activeTab === "workspace"}>
            Workspace
          </TabLink>
          <TabLink
            href={`/w/${workspaceId}/members?tab=boards`}
            active={activeTab === "boards"}
          >
            Tablice ({boards.length})
          </TabLink>
        </nav>
      )}

      {activeTab === "workspace" && (
        <>
          {canInvite && (
            <InviteForm
              workspaceId={workspace.id}
              boards={canManageBoardMembers ? boards.map((b) => ({ id: b.id, name: b.name })) : []}
            />
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-[1.2rem] leading-[1.15] tracking-[-0.02em]">
                Członkowie ({memberships.length})
              </h3>
            </div>
            <div className="flex flex-col border-t border-border">
              {memberships.map((m) => (
                <MemberRow
                  key={m.id}
                  workspaceId={workspace.id}
                  membershipId={m.id}
                  name={m.user.name}
                  email={m.user.email}
                  avatarUrl={m.user.avatarUrl}
                  role={m.role}
                  isSelf={m.userId === ctx.userId}
                  isOwner={m.userId === workspace.ownerId}
                  canManage={canManage}
                  canRemove={canRemove}
                />
              ))}
            </div>
          </section>

          {invitations.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[1.2rem] leading-[1.15] tracking-[-0.02em]">
                  Oczekujące zaproszenia ({invitations.length})
                </h3>
              </div>
              <div className="flex flex-col border-t border-border">
                {invitations.map((inv) => (
                  <PendingInviteRow
                    key={inv.id}
                    workspaceId={workspace.id}
                    invitationId={inv.id}
                    email={inv.email}
                    role={inv.role}
                    inviteUrl={`${origin}/invites/${inv.token}`}
                    expiresAt={inv.expiresAt}
                    boardName={inv.board?.name ?? null}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "boards" && canManageBoardMembers && (
        <BoardMembersSection
          workspaceId={workspace.id}
          boards={boards}
          selected={selectedBoard}
          members={boardMembers.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
          }))}
          workspaceMembers={memberships.map((m) => ({
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
          }))}
        />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active}
      className="-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-foreground"
    >
      {children}
    </Link>
  );
}
