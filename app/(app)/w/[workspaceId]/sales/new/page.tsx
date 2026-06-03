import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ensureDefaultStages } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { DealForm } from "@/components/sales/deal-form";

export default async function NewDealPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ stageId?: string; contactId?: string }>;
}) {
  const { workspaceId } = await params;
  const { stageId, contactId } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);
  if (!can(ctx.role, "deal.create")) {
    redirect(`/w/${workspaceId}/sales`);
  }
  await ensureDefaultStages(workspaceId);

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
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Nowy deal</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              Dodaj <span className="text-brand-gradient">deal</span>
            </h1>
          </div>
        </div>

        <DealForm
          mode="create"
          workspaceId={workspaceId}
          initial={null}
          defaultStageId={stageId ?? null}
          defaultContactId={contactId ?? null}
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
      </div>
    </main>
  );
}
