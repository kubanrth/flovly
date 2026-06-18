import Link from "next/link";
import { ChevronRight, FolderOpen } from "lucide-react";
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
        // Mobile v4 (B11 — Empty state): 64x64 brand-tinted icon + heading + body + CTA.
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center md:py-16">
          <span
            className="grid h-16 w-16 place-items-center rounded-[18px] border border-primary/25 bg-primary/12 text-primary"
            aria-hidden
          >
            <FolderOpen size={28} strokeWidth={1.8} />
          </span>
          <p className="mt-4 font-display text-[1rem] font-semibold text-foreground md:text-[1.05rem]">
            Brak boardów
          </p>
          <p className="mt-1.5 max-w-[36ch] text-[0.84rem] leading-[1.5] text-muted-foreground">
            Utwórz pierwszy brief, aby zacząć — wybierz template i nadaj nazwę.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((b) => (
            <li key={b.id}>
              <Link
                href={`/w/${workspaceId}/briefs/${b.id}`}
                // Mobile v4 (B11 — Briefs list): min-h-[88px] keeps tap target generous;
                // ChevronRight on right gives mobile users an "Edytuj" affordance.
                className="group flex h-full min-h-[88px] flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[0_8px_22px_-12px_rgba(123,104,238,0.35)]"
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
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground sm:hidden"
                    aria-hidden
                  />
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
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
