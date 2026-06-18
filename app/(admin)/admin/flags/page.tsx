// /admin/flags — system-level kill switches panel.
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` (452px panel, 5 toggles).
// Each row shows: monospace key + human description + "last changed by" meta
// + toggle (rendered by the client child).

import { Flag } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { SystemFlagsToggle } from "@/components/admin/system-flags-toggle";
import {
  SYSTEM_FLAGS,
  SYSTEM_FLAG_KEYS,
  type SystemFlagKey,
} from "@/lib/system-flags";

export const dynamic = "force-dynamic";

interface FlagRow {
  key: SystemFlagKey;
  label: string;
  description: string;
  destructive: boolean;
  value: boolean;
  lastChangedAt: string | null;
  lastChangedBy: { name: string | null; email: string } | null;
}

async function loadFlags(): Promise<FlagRow[]> {
  // Read all stored rows + collect updatedBy IDs to batch-resolve actors.
  const stored = await db.systemFlag.findMany({
    where: { key: { in: SYSTEM_FLAG_KEYS } },
    select: { key: true, value: true, updatedAt: true, updatedBy: true },
  });

  const storedById = new Map(stored.map((s) => [s.key, s]));

  // Single fetch for actors — avoid N user.findUnique calls per row.
  const actorIds = Array.from(
    new Set(stored.map((s) => s.updatedBy).filter((id): id is string => !!id)),
  );
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return SYSTEM_FLAG_KEYS.map((key) => {
    const def = SYSTEM_FLAGS[key];
    const row = storedById.get(key);
    const value =
      row?.value === undefined || row.value === null
        ? def.defaultValue
        : row.value === true || row.value === "true";

    const actor = row?.updatedBy ? actorById.get(row.updatedBy) ?? null : null;

    return {
      key,
      label: def.label,
      description: def.description,
      destructive: def.destructive,
      value,
      lastChangedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      lastChangedBy: actor
        ? { name: actor.name ?? null, email: actor.email }
        : null,
    };
  });
}

export default async function AdminFlagsPage() {
  await requireSuperAdmin();
  const flags = await loadFlags();

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow inline-flex items-center gap-1.5">
            <Flag size={11} /> Flagi systemowe
          </span>
          <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
            Kill switches
          </h1>
          <p className="text-[0.84rem] text-muted-foreground md:text-[0.88rem]">
            Globalne przełączniki funkcji aplikacji. Zmiany wchodzą natychmiast i
            są logowane w audycie admina.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 md:p-4">
          {flags.map((flag) => (
            <SystemFlagsToggle key={flag.key} flag={flag} />
          ))}
        </div>
      </div>
    </main>
  );
}
