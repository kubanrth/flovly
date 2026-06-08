import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import {
  ContactsTable,
  type ContactsTableRow,
} from "@/components/contacts/contacts-table";

export default async function ContactsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspaceId } = await params;
  const { q } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const canCreate = can(ctx.role, "contact.create");
  const canDelete = can(ctx.role, "contact.delete");

  const query = (q ?? "").trim();
  const where = query
    ? {
        workspaceId,
        deletedAt: null,
        OR: [
          { companyName: { contains: query, mode: "insensitive" as const } },
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { nip: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : { workspaceId, deletedAt: null };

  const contacts = await db.contact.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    select: {
      id: true,
      companyName: true,
      firstName: true,
      lastName: true,
      position: true,
      email: true,
      phone: true,
      nip: true,
      regon: true,
      vatNumber: true,
      website: true,
      street: true,
      city: true,
      postalCode: true,
      country: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const rows: ContactsTableRow[] = contacts.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    firstName: c.firstName,
    lastName: c.lastName,
    position: c.position,
    email: c.email,
    phone: c.phone,
    nip: c.nip,
    regon: c.regon,
    vatNumber: c.vatNumber,
    website: c.website,
    street: c.street,
    city: c.city,
    postalCode: c.postalCode,
    country: c.country,
    updatedAt: c.updatedAt.toISOString(),
    owner: c.owner
      ? {
          id: c.owner.id,
          name: c.owner.name,
          email: c.owner.email,
          avatarUrl: c.owner.avatarUrl,
        }
      : null,
  }));

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Kontakty B2B</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              {contacts.length} {pluralPl(contacts.length, "kontakt", "kontakty", "kontaktów")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={`/w/${workspaceId}/contacts`} className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  name="q"
                  type="search"
                  defaultValue={query}
                  placeholder="szukaj po firmie / email / NIP…"
                  className="h-9 w-full rounded-md border border-border bg-card pl-7 pr-3 text-[0.88rem] outline-none focus:border-primary md:w-[260px]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Szukaj
              </button>
            </form>
            {canCreate && (
              <Link
                href={`/w/${workspaceId}/contacts/new`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90"
              >
                <Plus size={13} /> Nowy kontakt
              </Link>
            )}
          </div>
        </div>

        <ContactsTable
          workspaceId={workspaceId}
          rows={rows}
          canDelete={canDelete}
        />
      </div>
    </main>
  );
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
