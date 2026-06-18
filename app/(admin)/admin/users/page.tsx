import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  softDeleteUserAction,
  toggleSuperAdminAction,
  toggleUserBanAction,
} from "@/app/(admin)/admin/actions";
import { plPlural } from "@/lib/pluralize";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import {
  UsersBulkBar,
  UsersRowCheckbox,
  UsersSelectAllCheckbox,
  UsersSelectionProvider,
} from "@/components/admin/users-bulk-actions";

// Pagination: 50 rows/page. >50 users hits the pager footer; ≤50 stays single-page.
const PAGE_SIZE = 50;

async function loadUsers(query: string, limit: number, offset: number) {
  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            memberships: { where: { workspace: { deletedAt: null } } },
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return { users, total };
}

type UserRow = Awaited<ReturnType<typeof loadUsers>>["users"][number];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { q, page } = await searchParams;
  const query = (q ?? "").trim();
  const pageNum = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const { users, total } = await loadUsers(query, PAGE_SIZE, offset);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectableIds = users.filter((u) => u.id !== admin.userId).map((u) => u.id);

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Użytkownicy</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              {total} {plPlural(total, "konto", "konta", "kont")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/admin/users" className="flex items-center gap-2">
              <input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="szukaj po email / imię…"
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-[0.88rem] outline-none focus:border-primary md:w-[260px]"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Szukaj
              </button>
            </form>
            <CreateUserDialog />
          </div>
        </div>

        <UsersSelectionProvider allIds={selectableIds}>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="border-b border-border bg-muted/50">
                  <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="w-[28px] px-3 py-2">
                      <UsersSelectAllCheckbox />
                    </th>
                    <th className="px-4 py-2">Użytkownik</th>
                    <th className="px-4 py-2">Rola</th>
                    <th className="px-4 py-2">Przestrzenie</th>
                    <th className="px-4 py-2">Ostatnio</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} isSelf={u.id === admin.userId} />
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
                {query ? "Brak dopasowań." : "Brak użytkowników."}
              </p>
            )}
          </div>

          {total > PAGE_SIZE && (
            <Pager
              page={pageNum}
              totalPages={totalPages}
              total={total}
              query={query}
              shown={users.length}
              offset={offset}
            />
          )}

          {/* Sticky bulk-action bar — appears only with ≥1 row selected. */}
          <UsersBulkBar />
        </UsersSelectionProvider>
      </div>
    </main>
  );
}

function Pager({
  page,
  totalPages,
  total,
  query,
  shown,
  offset,
}: {
  page: number;
  totalPages: number;
  total: number;
  query: string;
  shown: number;
  offset: number;
}) {
  const qParam = query ? `&q=${encodeURIComponent(query)}` : "";
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + shown;
  return (
    <nav
      aria-label="Strony"
      className="flex flex-wrap items-center justify-between gap-2 text-[0.78rem] text-muted-foreground"
    >
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em]">
        {from}–{to} z {total}
      </span>
      <div className="flex items-center gap-1">
        <PagerLink
          disabled={prevDisabled}
          href={`/admin/users?page=${page - 1}${qParam}`}
          aria-label="Poprzednia"
        >
          <ChevronLeft size={13} />
        </PagerLink>
        <span className="px-2 font-mono text-[0.66rem] uppercase tracking-[0.12em]">
          {page} / {totalPages}
        </span>
        <PagerLink
          disabled={nextDisabled}
          href={`/admin/users?page=${page + 1}${qParam}`}
          aria-label="Następna"
        >
          <ChevronRight size={13} />
        </PagerLink>
      </div>
    </nav>
  );
}

function PagerLink({
  disabled,
  href,
  children,
  ...rest
}: {
  disabled: boolean;
  href: string;
  children: React.ReactNode;
} & React.AriaAttributes) {
  if (disabled)
    return (
      <span
        aria-disabled
        {...rest}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground/40"
      >
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      {...rest}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function UserRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
  const isDeleted = !!user.deletedAt;

  return (
    <tr
      data-deleted={isDeleted ? "true" : "false"}
      className="border-b border-border last:border-b-0 data-[deleted=true]:opacity-60"
    >
      <td className="px-3 py-3">
        {!isSelf && !isDeleted && <UsersRowCheckbox id={user.id} />}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.68rem] font-bold text-white">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[0.88rem] font-medium">
              {user.name ?? user.email.split("@")[0]}
            </span>
            <span className="truncate font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {user.isSuperAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-primary">
            <ShieldCheck size={10} /> Super admin
          </span>
        ) : (
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
            Member
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[0.78rem]">{user._count.memberships}</td>
      <td className="px-4 py-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
        {user.lastSeenAt ? formatAgo(user.lastSeenAt) : "—"}
      </td>
      <td className="px-4 py-3">
        {isDeleted ? (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-destructive">
            <Trash2 size={10} /> Usunięty
          </span>
        ) : user.isBanned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-destructive">
            <Ban size={10} /> Zbanowany
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            <Check size={10} /> Aktywny
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="block text-right font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            to Ty
          </span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            {!isDeleted && (
              <ResetPasswordDialog userId={user.id} email={user.email} />
            )}
            {!isDeleted && (
              <form action={toggleSuperAdminAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={user.isSuperAdmin ? "Odbierz super admin" : "Nadaj super admin"}
                  title={user.isSuperAdmin ? "Odbierz super admin" : "Nadaj super admin"}
                >
                  {user.isSuperAdmin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                </button>
              </form>
            )}
            {!isDeleted && (
              <form action={toggleUserBanAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={user.isBanned ? "Odbanuj" : "Zbanuj"}
                  title={user.isBanned ? "Odbanuj" : "Zbanuj"}
                >
                  {user.isBanned ? <UserCheck size={13} /> : <Ban size={13} />}
                </button>
              </form>
            )}
            {!isDeleted && (
              <form action={softDeleteUserAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Usuń"
                  title="Usuń"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function formatAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "przed chwilą";
  if (diff < 3600) return `${Math.round(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h temu`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)} d temu`;
  return date.toLocaleDateString("pl-PL");
}
