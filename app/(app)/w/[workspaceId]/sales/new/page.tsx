import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ensureDefaultStages } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { DealForm } from "@/components/sales/deal-form";
import { IconChevronLeft } from "@/components/ui/icons";

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
      // colorHex potrzebny do swatch'a w SearchableDropdown.
      select: { id: true, name: true, colorHex: true },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
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
        nip: true,
      },
    }),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ minHeight: "calc(100dvh - var(--topbar))" }}>
      <header className="flex shrink-0 items-center gap-2 px-8 pt-4 max-md:px-4">
        <Link
          href={`/w/${workspaceId}/sales`}
          className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          <IconChevronLeft width={13} height={13} /> Plan sprzedaży
        </Link>
        <span aria-hidden className="text-n-400">/</span>
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Nowy deal</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-8 py-4 max-md:px-4">
        <div className="max-w-[720px]">
        <DealForm
          mode="create"
          workspaceId={workspaceId}
          initial={null}
          defaultStageId={stageId ?? null}
          defaultContactId={contactId ?? null}
          stages={stages}
          members={memberships.map((m) => m.user)}
          contacts={contacts.map((c) => {
            const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
            const labelBase =
              c.companyName ?? (person !== "" ? person : (c.email ?? "—"));
            const sublabel =
              c.companyName && person !== ""
                ? person
                : (c.email ?? c.nip ?? null);
            return { id: c.id, label: labelBase, sublabel };
          })}
          />
        </div>
      </div>
    </div>
  );
}
