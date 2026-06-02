import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { deleteDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { DealForm } from "@/components/sales/deal-form";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; dealId: string }>;
}) {
  const { workspaceId, dealId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId, deletedAt: null },
  });
  if (!deal) notFound();

  const [stages, memberships, contacts] = await Promise.all([
    db.dealStage.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.contact.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        email: true,
      },
    }),
  ]);

  const canEdit = can(ctx.role, "deal.update");
  const canDelete = can(ctx.role, "deal.delete");

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href={`/w/${workspaceId}/sales`}
            className="eyebrow inline-flex w-fit items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} /> Pipeline
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="eyebrow">Deal</span>
              <h1 className="truncate font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
                {deal.title}
              </h1>
            </div>
            {canDelete && (
              <form action={deleteDealAction} className="m-0">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="dealId" value={deal.id} />
                <button
                  type="submit"
                  aria-label="Usuń deal"
                  title="Usuń deal"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 size={12} /> Usuń
                </button>
              </form>
            )}
          </div>
        </div>

        {canEdit ? (
          <DealForm
            mode="edit"
            workspaceId={workspaceId}
            initial={{
              id: deal.id,
              title: deal.title,
              valueAmount: deal.valueAmount,
              valueCurrency: deal.valueCurrency,
              expectedCloseAt: deal.expectedCloseAt
                ? deal.expectedCloseAt.toISOString()
                : null,
              stageId: deal.stageId,
              ownerId: deal.ownerId,
              contactId: deal.contactId,
            }}
            stages={stages}
            members={memberships.map((m) => m.user)}
            contacts={contacts.map((c) => ({
              id: c.id,
              label:
                c.companyName ??
                [c.firstName, c.lastName].filter(Boolean).join(" ") ??
                c.email ??
                "—",
            }))}
          />
        ) : (
          <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
            Twoja rola nie pozwala na edycję deala.
          </p>
        )}
      </div>
    </main>
  );
}
