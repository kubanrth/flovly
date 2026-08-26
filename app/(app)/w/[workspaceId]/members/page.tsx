import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { InviteForm } from "@/components/members/invite-form";
import { MemberRow } from "@/components/members/member-row";
import { PendingInviteRow } from "@/components/members/pending-invite-row";
import { BoardMembersSection } from "@/components/members/board-members-section";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";

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
    select: { id: true, ownerId: true, name: true, slug: true, description: true },
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
    <div className="flex flex-col gap-4">
      <WorkspaceHeader workspace={workspace} canEditSettings={can(ctx.role, "workspace.updateSettings")} />
      <p className="max-w-[80ch] text-xs text-fg-2">
        Admini mogą zapraszać do całej przestrzeni albo do konkretnej tablicy. Tablica może być
        publiczna (widzą wszyscy) lub prywatna (tylko wyraźnie dodani).
      </p>

      {canManageBoardMembers && (
        <nav className="flex items-center gap-0.5 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <div className="flex flex-col gap-4">
          {canInvite && (
            <InviteForm
              workspaceId={workspace.id}
              boards={canManageBoardMembers ? boards.map((b) => ({ id: b.id, name: b.name })) : []}
            />
          )}

          <section className="flex flex-col gap-2">
            <span className="eyebrow">Członkowie ({memberships.length})</span>
            <div className="overflow-hidden rounded-lg border border-border">
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
            <section className="flex flex-col gap-2">
              <span className="eyebrow">Oczekujące zaproszenia ({invitations.length})</span>
              <div className="overflow-hidden rounded-lg border border-border">
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
        </div>
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
      className="inline-flex h-10 items-center rounded-sm px-2.5 text-sm font-medium text-muted-foreground no-underline outline-none hover:text-foreground data-[active=true]:text-foreground data-[active=true]:shadow-[inset_0_-2px_0_var(--orange-500)]"
    >
      {children}
    </Link>
  );
}
