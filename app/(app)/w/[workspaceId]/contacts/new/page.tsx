import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function NewContactPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  if (!can(ctx.role, "contact.create")) {
    redirect(`/w/${workspaceId}/contacts`);
  }

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href={`/w/${workspaceId}/contacts`}
            className="eyebrow inline-flex w-fit items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} /> Wszystkie kontakty
          </Link>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Nowy kontakt</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              Dodaj <span className="text-brand-gradient">kontrahenta</span>
            </h1>
          </div>
        </div>

        <ContactForm
          mode="create"
          workspaceId={workspaceId}
          initial={null}
          members={memberships.map((m) => m.user)}
        />
      </div>
    </main>
  );
}
