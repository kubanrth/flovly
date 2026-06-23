import Link from "next/link";
import Image from "next/image";
import { PencilRuler, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { AppShell } from "@/components/layout/app-shell";
import {
  computeBoardEnabledViews,
  parseEnabledViews,
} from "@/lib/board-views";
import {
  SortableBoardsGrid,
  SortableBoardsList,
  type BoardSectionData,
} from "@/components/workspaces/sortable-boards";
import { BoardsLayoutToggle } from "@/components/workspaces/boards-layout-toggle";
import { CreateBoardDialog } from "@/components/workspaces/create-board-dialog";

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  // Workspace name + memberships (with user avatars) for the v4 hero band.
  // We cap the membership query at 6 so the avatar stack covers 5 + "+N" chip;
  // the count() below gives the true total for the overflow label.
  const [workspace, memberCount, memberships, boards] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { enabledViews: true, name: true },
    }),
    db.workspaceMembership.count({ where: { workspaceId } }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      take: 6,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    // ADMIN sees all; MEMBER/VIEWER sees PUBLIC + explicit memberships.
    db.board.findMany({
      where:
        ctx.role === "ADMIN"
          ? { workspaceId, deletedAt: null }
          : {
              workspaceId,
              deletedAt: null,
              OR: [
                { visibility: "PUBLIC" },
                { memberships: { some: { userId: ctx.userId } } },
              ],
            },
      // Honour user-set drag-and-drop order; fall back to createdAt.
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        statusColumns: { orderBy: { order: "asc" } },
        views: { select: { type: true, name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
          take: 20,
          include: {
            assignees: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
            tags: { include: { tag: true } },
            statusColumn: true,
          },
        },
      },
    }),
  ]);

  const canCreateTask = can(ctx.role, "task.create");
  const firstBoard = boards[0];
  const workspaceEnabled = parseEnabledViews(workspace?.enabledViews);

  const boardSections: BoardSectionData[] = boards.map((board) => {
    const boardDefaultTypes = board.views
      .filter((v) => v.name === null)
      .map((v) => v.type);
    return {
      id: board.id,
      name: board.name,
      taskCount: board._count.tasks,
      enabledViews: computeBoardEnabledViews(workspaceEnabled, boardDefaultTypes),
      tasks: board.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        stopAt: task.stopAt ? task.stopAt.toISOString() : null,
        statusName: task.statusColumn?.name ?? null,
        statusColor: task.statusColumn?.colorHex ?? null,
        assignees: task.assignees.map((a) => ({
          userId: a.userId,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
        })),
        tags: task.tags.map(({ tag }) => ({
          id: tag.id,
          name: tag.name,
          colorHex: tag.colorHex,
        })),
      })),
    };
  });

  // Avatar stack: first 5 members; overflow is total - 5 (clamp 0).
  const avatarMembers = memberships.slice(0, 5).map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
  }));
  const overflow = Math.max(0, memberCount - avatarMembers.length);

  const canCreateBoard = can(ctx.role, "board.create");
  // CreateBoardDialog expects the uppercase Prisma view types — map down
  // from the lowercase ViewName[] set, drop the ones the dialog can't seed.
  const DIALOG_VIEWS = ["TABLE", "KANBAN", "ROADMAP", "GANTT", "WHITEBOARD"] as const;
  const dialogEnabledViews = workspaceEnabled
    .map((v) => v.toUpperCase())
    .filter((v): v is (typeof DIALOG_VIEWS)[number] =>
      (DIALOG_VIEWS as readonly string[]).includes(v),
    );

  return (
    <AppShell>
      <div className="flex flex-col gap-6 md:gap-10">
        <WorkspaceHero
          workspaceId={workspaceId}
          workspaceName={workspace?.name ?? "Workspace"}
          members={avatarMembers}
          overflow={overflow}
          memberCount={memberCount}
          canCreateBoard={canCreateBoard}
          enabledViews={dialogEnabledViews}
        >
          {/* Secondary actions stay on the right of the hero — whiteboard link
              + (optional) quick "+ Zadanie" once a board exists. */}
          <Link
            href={`/w/${workspaceId}/canvases`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/60 bg-white/55 px-3 font-sans text-[0.82rem] font-medium text-foreground/80 backdrop-blur transition-colors hover:bg-white/75 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-white/10 dark:bg-white/5 dark:text-foreground/70 dark:hover:bg-white/10 dark:hover:text-foreground"
          >
            <PencilRuler size={14} /> Whiteboard
          </Link>
          {firstBoard && canCreateTask && (
            <CreateTaskButton workspaceId={workspaceId} boardId={firstBoard.id} />
          )}
        </WorkspaceHero>

        <BoardsLayoutToggle
          grid={<SortableBoardsGrid workspaceId={workspaceId} boards={boardSections} />}
          list={<SortableBoardsList workspaceId={workspaceId} boards={boardSections} />}
        />
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// F12-K81 (v4 brand polish): workspace hero band.
// Glass card rounded-[22px] z animated fl-drift radial aura blobs, eyebrow
// mono "Workspace", workspace name 17px display bold, avatar stack (5 + +N),
// glass search bar + "+ Tablica" gradient CTA pill po prawej.
// Layout 1:1 z Flovly Brand & Hero spec (sekcja 05 — Workspace Overview).
// ─────────────────────────────────────────────────────────────────────────
function WorkspaceHero({
  workspaceId,
  workspaceName,
  members,
  overflow,
  memberCount,
  canCreateBoard,
  enabledViews,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
  overflow: number;
  memberCount: number;
  canCreateBoard: boolean;
  enabledViews: Array<"TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD">;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Workspace overview"
      // F12-K107: mobile bez glass card wrapper + blobs (klient raportował
      // że hero wygląda mały vs pełnoekranowe board cards = visual mismatch).
      // Mobile = inline (border-b only). Desktop md+ = glass card z aurą.
      className="relative md:overflow-hidden md:rounded-[22px] md:border md:border-white/60 md:bg-white/70 md:px-6 md:py-5 md:shadow-[0_18px_40px_-24px_rgba(76,29,149,0.26)] md:dark:border-white/10 md:dark:bg-white/[0.04] max-md:border-b max-md:border-border max-md:pb-4"
    >
      {/* F12-K85 perf: blobs są STATIC. F12-K107: tylko desktop (md+). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 hidden h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(122,51,236,0.28),transparent_65%)] blur-3xl md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-16 hidden h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(225,49,143,0.22),transparent_65%)] blur-3xl md:block"
      />

      {/* Foreground row: eyebrow + name + avatars (left)  |  search + CTA (right) */}
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-5">
        {/* Left cluster */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-eyebrow">Workspace</span>
            <span
              className="truncate font-display text-[20px] font-bold leading-tight tracking-[-0.015em] text-foreground md:text-[17px]"
              title={workspaceName}
            >
              {workspaceName}
            </span>
          </div>
          {/* Avatar stack — max 5 + overflow chip. Aria-label opisuje pełen count. */}
          <div
            className="hidden items-center md:flex"
            aria-label={`${memberCount} członków workspace`}
          >
            {members.map((m, idx) => (
              <MemberAvatar
                key={m.id}
                name={m.name || m.email}
                avatarUrl={m.avatarUrl}
                style={{
                  marginLeft: idx === 0 ? 0 : -8,
                  zIndex: members.length - idx,
                }}
              />
            ))}
            {overflow > 0 && (
              <span
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-50 font-mono text-[0.62rem] font-semibold text-brand-700 dark:border-[#15121F] dark:bg-white/10 dark:text-brand-200"
                style={{ marginLeft: members.length > 0 ? -8 : 0, zIndex: 0 }}
              >
                +{overflow}
              </span>
            )}
          </div>
        </div>

        {/* Right cluster — mobile = full width row, desktop = inline */}
        <div className="flex flex-wrap items-center gap-2 max-md:w-full">
          {/* Glass search bar — purely visual stub for v4 brand polish; we
              don't have a global search yet (note in handoff). */}
          <label
            htmlFor="ws-hero-search"
            className="flex h-9 items-center gap-2 rounded-lg border border-white/70 bg-white/65 px-3 font-sans text-[0.82rem] text-muted-foreground backdrop-blur transition-colors focus-within:border-primary/40 focus-within:bg-white/85 max-md:flex-1 dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/[0.08]"
          >
            <Search size={14} aria-hidden="true" />
            <input
              id="ws-hero-search"
              type="search"
              placeholder="Szukaj zadań…"
              className="bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70 max-md:w-full md:w-[200px]"
            />
          </label>

          {children}

          {canCreateBoard && (
            <CreateBoardDialog
              workspaceId={workspaceId}
              variant="cta"
              label="Tablica"
              workspaceEnabledViews={enabledViews}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// Member avatar — image with fallback to initials chip in brand gradient.
// 28×28 with white ring (matches v4 spec line 237-239 avatar stack).
function MemberAvatar({
  name,
  avatarUrl,
  style,
}: {
  name: string;
  avatarUrl: string | null;
  style?: React.CSSProperties;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-brand-gradient text-[0.62rem] font-bold uppercase text-white shadow-sm dark:border-[#15121F]"
      style={style}
      title={name}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={28}
          height={28}
          className="h-full w-full object-cover"
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
