import Link from "next/link";
import { IconArrowRight, IconPlus } from "@/components/ui/icons";

export interface ContactPipelineStage {
  id: string;
  name: string;
  colorHex: string;
  closedKind: "won" | "lost" | null;
}

export interface ContactPipelineDeal {
  id: string;
  title: string;
  valueAmount: number | null;
  valueCurrency: string;
  stageId: string;
}

const PL_MONEY = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
function formatMoney(amount: number, currency: string): string {
  return `${PL_MONEY.format(amount)} ${currency}`;
}

const CHEVRON_NOTCH = 12;
// Stage colours are user-picked hex from the DB, so the readable text colour
// is computed — but both outcomes are design tokens, never literals.
function readableOn(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "var(--n-0)";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 150 ? "var(--n-900)" : "var(--n-0)";
}
function chevronClipPath(isFirst: boolean, isLast: boolean): string {
  const n = CHEVRON_NOTCH;
  if (isFirst && isLast) return "none";
  if (isFirst)
    return `polygon(0% 0%, calc(100% - ${n}px) 0%, 100% 50%, calc(100% - ${n}px) 100%, 0% 100%)`;
  if (isLast)
    return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${n}px 50%)`;
  return `polygon(0% 0%, calc(100% - ${n}px) 0%, 100% 50%, calc(100% - ${n}px) 100%, 0% 100%, ${n}px 50%)`;
}

// Static per-contact view of the workspace's deal pipeline. Shows every stage
// but each column only lists deals where contactId = this contact. No drag-
// drop here — moving a deal is the main /sales page's job; this view is
// purely a per-lead readout. "+ Deal" CTAs jump to the new-deal form with
// stage + contact pre-selected.
export function ContactPipeline({
  workspaceId,
  contactId,
  stages,
  deals,
}: {
  workspaceId: string;
  contactId: string;
  stages: ContactPipelineStage[];
  deals: ContactPipelineDeal[];
}) {
  const dealsByStage = new Map<string, ContactPipelineDeal[]>();
  for (const s of stages) dealsByStage.set(s.id, []);
  for (const d of deals) {
    const arr = dealsByStage.get(d.stageId);
    if (arr) arr.push(d);
  }

  if (stages.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-[0.86rem] text-muted-foreground">
        Workspace nie ma jeszcze pipeline&apos;u. Wejdź w „Plan sprzedaży” żeby
        utworzyć etapy.
      </p>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {stages.map((stage, idx) => {
        const colDeals = dealsByStage.get(stage.id) ?? [];
        const isFirst = idx === 0;
        const isLast = idx === stages.length - 1;
        const fg = readableOn(stage.colorHex);
        const headerLeftPad = isFirst ? 14 : CHEVRON_NOTCH + 8;
        const headerRightPad = isLast ? 14 : CHEVRON_NOTCH + 8;
        const total = colDeals.reduce((s, d) => s + (d.valueAmount ?? 0), 0);
        return (
          <div
            key={stage.id}
            className="flex w-[240px] shrink-0 flex-col gap-2 rounded-lg bg-canvas pb-3"
          >
            <div
              className="flex h-9 items-center justify-between gap-2"
              style={{
                background: stage.colorHex,
                color: fg,
                clipPath: chevronClipPath(isFirst, isLast),
                paddingLeft: headerLeftPad,
                paddingRight: headerRightPad,
                borderRadius: isFirst && isLast ? 10 : 0,
              }}
            >
              <span className="truncate text-xs font-semibold">
                {stage.name}
              </span>
              <Link
                href={`/w/${workspaceId}/sales/new?stageId=${stage.id}&contactId=${contactId}`}
                aria-label={`Nowy deal dla tego kontaktu w etapie ${stage.name}`}
                title="Nowy deal dla tego kontaktu"
                className="grid size-6 shrink-0 place-items-center rounded-md outline-none hover:bg-n-900/10 active:bg-n-900/20"
                style={{ color: fg }}
              >
                <IconPlus width={12} height={12} />
              </Link>
            </div>

            {colDeals.length > 0 ? (
              <ul className="flex flex-col gap-1.5 px-2">
                {colDeals.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/w/${workspaceId}/sales/${d.id}`}
                      className="block overflow-hidden rounded-md border border-border bg-card no-underline outline-none hover:border-orange-300 active:border-orange-500"
                    >
                      <div className="flex flex-col gap-0.5 p-2.5">
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {d.valueAmount != null
                            ? formatMoney(d.valueAmount, d.valueCurrency)
                            : "—"}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {d.title}
                        </span>
                      </div>
                      <div
                        className="h-[2px] w-full"
                        style={{ background: stage.colorHex }}
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-2 grid h-10 place-items-center rounded-md border border-dashed border-input-border text-2xs text-fg-3">
                —
              </p>
            )}

            {total > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 pt-1">
                <span className="font-mono text-2xs text-muted-foreground">Suma</span>
                <span className="font-mono text-2xs font-semibold tabular-nums">
                  {formatMoney(total, colDeals[0]?.valueCurrency ?? "PLN")}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* End-of-row arrow hint — purely decorative. */}
      <div className="grid shrink-0 place-items-center px-2 text-n-400">
        <IconArrowRight width={14} height={14} />
      </div>
    </div>
  );
}
