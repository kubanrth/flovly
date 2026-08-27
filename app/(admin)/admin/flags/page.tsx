// /admin/flags — system-level kill switches panel.
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` (452px panel, 5 toggles).
// Each row shows: monospace key + human description + "last changed by" meta
// + toggle (rendered by the client child).

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Flagi systemowe</h1>
        <span className="max-w-[70ch] text-xs text-muted-foreground">
          Globalne przełączniki funkcji. Zmiany wchodzą natychmiast i trafiają do logu akcji admina.
        </span>
      </div>

      <div className="flex max-w-[720px] flex-col gap-1.5 rounded-lg border border-border bg-canvas p-2">
        {flags.map((flag) => (
          <SystemFlagsToggle key={flag.key} flag={flag} />
        ))}
      </div>
    </div>
  );
}
