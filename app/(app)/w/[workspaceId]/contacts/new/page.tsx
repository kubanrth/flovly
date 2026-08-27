import Link from "next/link";
import { redirect } from "next/navigation";
import { IconChevronLeft } from "@/components/ui/icons";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-8 py-5 max-md:px-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/w/${workspaceId}/contacts`}
            className="inline-flex w-fit items-center gap-1 rounded-[2px] text-xs text-muted-foreground no-underline outline-none hover:text-orange-800 active:text-orange-900"
          >
            <IconChevronLeft width={12} height={12} /> Wszystkie kontakty
          </Link>
          <h1 className="text-xl font-semibold tracking-[-0.3px]">Nowy kontakt</h1>
        </div>

        <ContactForm
          mode="create"
          workspaceId={workspaceId}
          initial={null}
          members={memberships.map((m) => m.user)}
        />
      </div>
    </div>
  );
}
