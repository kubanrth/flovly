import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { NewBriefForm } from "@/components/briefs/new-brief-form";

const STATUS_LABEL = {
  DRAFT: "Szkic",
  IN_REVIEW: "W recenzji",
  APPROVED: "Zatwierdzony",
  ARCHIVED: "Zarchiwizowany",
} as const;

const STATUS_COLOR = {
  DRAFT: "#64748B",
  IN_REVIEW: "#F59E0B",
  APPROVED: "#10B981",
  ARCHIVED: "#94A3B8",
} as const;

export default async function CreativeBriefsListPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const briefs = await db.creativeBrief.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5 p-4 md:gap-6 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Workspace</span>
          <h1 className="font-display text-[1.6rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2.2rem]">
            <span className="text-brand-gradient">Creative</span> Board.
          </h1>
          <p className="max-w-[60ch] text-[0.88rem] leading-[1.5] text-muted-foreground md:text-[0.95rem] md:leading-[1.55]">
            Strukturalne dokumenty projektowe — cele, grupa docelowa,
            deliverables, brand guidelines, referencje, timeline. Tabele,
            kolory, emoji, obrazy. Każdy nowy brief startuje z gotowego template&apos;a.
          </p>
        </div>
        <NewBriefForm workspaceId={workspaceId} />
      </div>

      {briefs.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-display text-[1rem] font-semibold">Brak boardów.</p>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            kliknij „Nowy board” powyżej
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((b) => (
            <li key={b.id}>
              <Link
                href={`/w/${workspaceId}/briefs/${b.id}`}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[0_8px_22px_-12px_rgba(123,104,238,0.35)]"
              >
                <div
                  className="h-1 w-full rounded-full"
                  style={{ background: b.headerColor ?? "#7C5CFF" }}
                  aria-hidden
                />
                <div className="flex items-center gap-2">
                  {b.emoji && <span className="text-[1.2rem]">{b.emoji}</span>}
                  <span className="flex-1 truncate font-display text-[1rem] font-semibold leading-tight tracking-[-0.01em]">
                    {b.title}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span
                    className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      color: STATUS_COLOR[b.status],
                      background: `${STATUS_COLOR[b.status]}1F`,
                    }}
                  >
                    {STATUS_LABEL[b.status]}
                  </span>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {b.creator.name ?? b.creator.email.split("@")[0]} ·{" "}
                    {new Date(b.updatedAt).toLocaleDateString("pl-PL")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
