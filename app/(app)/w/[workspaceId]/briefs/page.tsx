import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BriefsBoard, type BriefCardData } from "@/components/briefs/briefs-board";
import { briefExcerpt, type BriefStatus } from "@/components/briefs/brief-segments";

export default async function CreativeBoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [briefs, board] = await Promise.all([
    db.creativeBrief.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { creator: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    // Pierwsza tablica przestrzeni = cel przycisku „Zrób zadanie".
    db.board.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }),
  ]);

  // Powiązanie pomysł → zadanie po tytule: „Zrób zadanie" tworzy zadanie
  // o tytule pomysłu, a schemat nie ma pola na tę relację (OMITTED.md).
  const titles = briefs.map((b) => b.title);
  const tasks = titles.length
    ? await db.task.findMany({
        where: { workspaceId, deletedAt: null, title: { in: titles } },
        orderBy: { createdAt: "asc" },
        select: { id: true, displayId: true, title: true },
      })
    : [];
  const taskByTitle = new Map<string, { id: string; displayId: number }>();
  for (const t of tasks) {
    if (!taskByTitle.has(t.title)) taskByTitle.set(t.title, { id: t.id, displayId: t.displayId });
  }

  const cards: BriefCardData[] = briefs.map((b) => ({
    id: b.id,
    status: b.status as BriefStatus,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    title: b.title,
    excerpt: briefExcerpt(b.contentJson),
    emoji: b.emoji,
    authorName: b.creator.name ?? b.creator.email,
    authorAvatarUrl: b.creator.avatarUrl,
    task: taskByTitle.get(b.title) ?? null,
  }));

  // Bez prawa `task.create` przycisk „Zrób zadanie" w ogóle się nie pojawia —
  // akcja i tak by odmówiła, a przycisk-pułapka to zły UX.
  const taskBoardId = can(ctx.role, "task.create") ? (board?.id ?? null) : null;

  return <BriefsBoard workspaceId={workspaceId} briefs={cards} taskBoardId={taskBoardId} />;
}
