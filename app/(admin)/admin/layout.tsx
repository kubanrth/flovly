import { requireSuperAdmin } from "@/lib/admin-guard";
import { AdminDesktopSidebar, AdminMobileNav } from "@/components/admin/admin-nav";
import { Chip } from "@/components/ui/chip";
import { IconShieldCheck } from "@/components/ui/icons";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Bramka całego panelu — każda akcja admina sprawdza to jeszcze raz po swojej stronie.
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-border bg-canvas md:w-[240px] md:border-r md:border-b-0 md:p-2">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-2 md:py-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-n-900 text-n-0" aria-hidden>
              <IconShieldCheck width={14} height={14} />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">Panel admina</span>
              <Chip hue="orange" size="sm" className="mt-0.5 w-fit">Super admin</Chip>
            </span>
          </span>
          <span className="md:hidden">
            <AdminMobileNav />
          </span>
        </div>

        <div className="hidden md:flex md:flex-1 md:flex-col">
          <AdminDesktopSidebar />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-8 py-4 max-md:px-4">{children}</main>
    </div>
  );
}
