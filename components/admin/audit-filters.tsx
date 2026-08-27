// Wspólny pasek filtrów obu logów admina (audyt przestrzeni + akcje admina).
// Zwykły GET-owy formularz — stan siedzi w URL-u, więc bez „use client".

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PERIODS = [
  { value: "", label: "wszystko" },
  { value: "1", label: "24 h" },
  { value: "7", label: "7 dni" },
  { value: "30", label: "30 dni" },
  { value: "90", label: "90 dni" },
];

export function AuditFilters({
  action,
  actorLabel,
  actorPlaceholder,
  actionPlaceholder,
  defaults,
}: {
  action: string;
  actorLabel: string;
  actorPlaceholder: string;
  actionPlaceholder: string;
  defaults: { action?: string; actor?: string; days?: string };
}) {
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-canvas p-2.5"
    >
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Akcja</span>
        <Input
          name="action"
          defaultValue={defaults.action ?? ""}
          placeholder={actionPlaceholder}
          className="w-full md:w-[220px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">{actorLabel}</span>
        <Input
          name="actor"
          defaultValue={defaults.actor ?? ""}
          placeholder={actorPlaceholder}
          className="w-full md:w-[220px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Okres</span>
        {/* Natywny <select> — formularz jest bezskryptowy (GET), a `Select`
            z base-ui wymaga klienta. */}
        <select
          name="days"
          defaultValue={defaults.days ?? ""}
          aria-label="Okres"
          className="h-8 rounded-sm border border-input-border bg-card px-2 text-sm outline-none hover:border-input-border-hover focus:border-orange-500"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary">
        Zastosuj
      </Button>
    </form>
  );
}
