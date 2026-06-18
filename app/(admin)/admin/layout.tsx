import { ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminDesktopSidebar } from "@/components/admin/desktop-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      {/* Mobile (max-md): compact header w/ hamburger trigger → bottom sheet.
          Desktop (md+): fixed 240px sidebar w/ persistent nav list. */}
      <aside className="flex shrink-0 flex-col gap-2 border-b border-sidebar-border bg-sidebar md:w-[240px] md:border-b-0 md:border-r md:px-3 md:py-4">
        {/* Brand header — shared between mobile (top bar w/ hamburger) and
            desktop (sidebar logo). On desktop the AdminDesktopSidebar below
            renders its own Super Admin pill + nav. */}
        <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-2 md:py-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck size={14} />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
                Panel admina
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                super admin
              </span>
            </div>
          </div>
          {/* Mobile-only: hamburger opens bottom sheet w/ all admin sections. */}
          <div className="md:hidden">
            <AdminMobileNav />
          </div>
        </div>

        {/* Desktop sidebar — hidden on mobile (bottom sheet replaces it). */}
        <div className="hidden md:flex md:flex-1 md:flex-col">
          <AdminDesktopSidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
