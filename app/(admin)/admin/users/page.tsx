import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  softDeleteUserAction,
  toggleSuperAdminAction,
  toggleUserBanAction,
} from "@/app/(admin)/admin/actions";
import { plPlural } from "@/lib/pluralize";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  UsersBulkBar,
  UsersRowCheckbox,
  UsersSelectAllCheckbox,
  UsersSelectionProvider,
} from "@/components/admin/users-bulk-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconChevronLeft, IconChevronRight, IconSearch, IconShieldCheck, IconTrash } from "@/components/ui/icons";
import { InputGroup } from "@/components/ui/input";

// Paginacja: 50 wierszy na stronę.
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
        _count: { select: { memberships: { where: { workspace: { deletedAt: null } } } } },
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Użytkownicy</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {total} {plPlural(total, "konto", "konta", "kont")}
        </span>
        <span className="flex-1" />
        <form action="/admin/users" className="flex items-center gap-2">
          <InputGroup
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Szukaj po e-mailu lub imieniu…"
            aria-label="Szukaj użytkownika"
            leading={<IconSearch width={13} height={13} />}
            className="md:w-[260px]"
          />
          <Button type="submit" variant="secondary">
            Szukaj
          </Button>
        </form>
        <CreateUserDialog />
      </div>

      <UsersSelectionProvider allIds={selectableIds}>
        <DataTable
          className="[--row-h:44px]"
          footer={
            <DataFooter>
              {total === 0 ? 0 : offset + 1}–{offset + users.length} z {total}
            </DataFooter>
          }
        >
          <DataThead>
            <tr>
              <DataTh width={36} aria-label="Zaznacz">
                <UsersSelectAllCheckbox />
              </DataTh>
              <DataTh>Użytkownik</DataTh>
              <DataTh width={140}>Rola</DataTh>
              <DataTh width={120} align="right">Przestrzenie</DataTh>
              <DataTh width={130}>Ostatnio</DataTh>
              <DataTh width={130}>Status</DataTh>
              <DataTh width={140} align="right">Akcje</DataTh>
            </tr>
          </DataThead>
          <tbody>
            {users.map((u) => (
              <UserTableRow key={u.id} user={u} isSelf={u.id === admin.userId} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2.5 py-10 text-center text-sm text-muted-foreground">
                  {query ? "Brak dopasowań." : "Brak użytkowników."}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>

        {total > PAGE_SIZE && <Pager page={pageNum} totalPages={totalPages} query={query} />}

        {/* Pasek akcji zbiorczych — widoczny dopiero przy ≥1 zaznaczeniu. */}
        <UsersBulkBar />
      </UsersSelectionProvider>
    </div>
  );
}

function Pager({ page, totalPages, query }: { page: number; totalPages: number; query: string }) {
  const qParam = query ? `&q=${encodeURIComponent(query)}` : "";
  return (
    <nav aria-label="Strony" className="flex items-center justify-end gap-1">
      <PagerLink disabled={page <= 1} href={`/admin/users?page=${page - 1}${qParam}`} label="Poprzednia strona">
        <IconChevronLeft width={14} height={14} />
      </PagerLink>
      <span className="px-2 font-mono text-2xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <PagerLink
        disabled={page >= totalPages}
        href={`/admin/users?page=${page + 1}${qParam}`}
        label="Następna strona"
      >
        <IconChevronRight width={14} height={14} />
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  disabled,
  href,
  label,
  children,
}: {
  disabled: boolean;
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-label={label} aria-disabled className="grid size-7 place-items-center rounded-md text-n-400">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
    >
      {children}
    </Link>
  );
}

function UserTableRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const isDeleted = !!user.deletedAt;
  const displayName = user.name ?? user.email.split("@")[0]!;

  return (
    <DataTr className={isDeleted ? "opacity-60" : undefined}>
      <DataTd>{!isSelf && !isDeleted && <UsersRowCheckbox id={user.id} />}</DataTd>
      <DataTd>
        <span className="flex items-center gap-2.5">
          <Avatar name={displayName} src={user.avatarUrl} size={24} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate font-mono text-2xs text-fg-3">{user.email}</span>
          </span>
        </span>
      </DataTd>
      <DataTd>
        {user.isSuperAdmin ? (
          <Chip hue="orange" size="sm">Super admin</Chip>
        ) : (
          <span className="text-xs text-muted-foreground">Member</span>
        )}
      </DataTd>
      <DataTd align="right" className="font-mono text-xs">{user._count.memberships}</DataTd>
      <DataTd className="font-mono text-2xs text-muted-foreground">
        {user.lastSeenAt ? formatAgo(user.lastSeenAt) : "—"}
      </DataTd>
      <DataTd>
        {isDeleted ? (
          <Chip hue="red" size="sm">Usunięty</Chip>
        ) : user.isBanned ? (
          <Chip hue="red" dot size="sm">Zbanowany</Chip>
        ) : (
          <Chip hue="green" dot size="sm">Aktywny</Chip>
        )}
      </DataTd>
      <DataTd align="right">
        {isSelf ? (
          <span className="text-xs text-muted-foreground">to Ty</span>
        ) : (
          <span className="flex items-center justify-end gap-0.5">
            {!isDeleted && <ResetPasswordDialog userId={user.id} email={user.email} />}
            {!isDeleted && (
              <form action={toggleSuperAdminAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <ConfirmSubmit
                  label={user.isSuperAdmin ? "Odbierz super admin" : "Nadaj super admin"}
                  confirmMessage={
                    user.isSuperAdmin
                      ? `Odebrać uprawnienia super admina użytkownikowi ${user.email}?`
                      : `Nadać uprawnienia super admina użytkownikowi ${user.email}?`
                  }
                >
                  <IconShieldCheck width={14} height={14} />
                </ConfirmSubmit>
              </form>
            )}
            {!isDeleted && (
              <form action={toggleUserBanAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <ConfirmSubmit
                  label={user.isBanned ? "Odbanuj" : "Zbanuj"}
                  confirmMessage={
                    user.isBanned ? `Odbanować ${user.email}?` : `Zbanować ${user.email}?`
                  }
                >
                  <BanGlyph banned={user.isBanned} />
                </ConfirmSubmit>
              </form>
            )}
            {!isDeleted && (
              <form action={softDeleteUserAction} className="m-0">
                <input type="hidden" name="id" value={user.id} />
                <ConfirmSubmit
                  label="Usuń użytkownika"
                  destructive
                  confirmMessage={`Usunąć konto ${user.email}? Operacja jest miękka, ale użytkownik traci dostęp.`}
                >
                  <IconTrash width={14} height={14} />
                </ConfirmSubmit>
              </form>
            )}
          </span>
        )}
      </DataTd>
    </DataTr>
  );
}

// Zakaz/odblokowanie: kółko z ukośnikiem albo bez — `icons.tsx` nie ma bana.
function BanGlyph({ banned }: { banned: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      {banned ? (
        <path d="M5.5 8.2l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4.2 11.8l7.6-7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
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
