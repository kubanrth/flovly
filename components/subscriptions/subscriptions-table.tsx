"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { CreditCard, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  createSubscriptionAction,
  deleteSubscriptionAction,
  patchSubscriptionAction,
} from "@/app/(app)/w/[workspaceId]/subscriptions/actions";

type Cycle = "MONTHLY" | "YEARLY";

export interface SubscriptionRow {
  id: string;
  name: string;
  url: string | null;
  amountCents: number;
  cycle: Cycle;
  notes: string | null;
}

// F12-K140: "Excel, ale ładnie narysowany". Edycja inline (onBlur → patch),
// select cyklu zapisuje od razu, sumy liczone lokalnie (optymistycznie) —
// bez czekania na server roundtrip.
export function SubscriptionsTable({
  workspaceId,
  rows: serverRows,
}: {
  workspaceId: string;
  rows: SubscriptionRow[];
}) {
  const [rows, setRows] = useState<SubscriptionRow[]>(serverRows);
  useEffect(() => setRows(serverRows), [serverRows]);

  const patchLocal = (id: string, patch: Partial<SubscriptionRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const send = (id: string, fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("id", id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => void patchSubscriptionAction(fd));
  };

  const addRow = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    startTransition(() => void createSubscriptionAction(fd));
  };

  const removeRow = (id: string, name: string) => {
    if (!confirm(`Usunąć subskrypcję${name ? ` „${name}"` : ""}?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => void deleteSubscriptionAction(fd));
  };

  // Sumy: miesięczna = MONTHLY + YEARLY/12; roczna = MONTHLY*12 + YEARLY.
  const totals = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    for (const r of rows) {
      if (r.cycle === "MONTHLY") {
        monthly += r.amountCents;
        yearly += r.amountCents * 12;
      } else {
        monthly += r.amountCents / 12;
        yearly += r.amountCents;
      }
    }
    return { monthly, yearly };
  }, [rows]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-6 md:py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-2">
          <CreditCard size={12} /> Subskrypcje
        </span>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] md:text-[2.4rem]">
          Subskrypcje firmy
        </h1>
        <p className="max-w-[62ch] text-[0.94rem] leading-[1.55] text-muted-foreground">
          Wszystkie aktywne narzędzia i serwisy w jednym miejscu. Kliknij w
          komórkę żeby edytować — zapisuje się samo.
        </p>
      </header>

      {/* KPI — podsumowanie "w jedno" */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Miesięcznie" value={fmtPln(totals.monthly)} highlight />
        <Kpi label="Rocznie" value={fmtPln(totals.yearly)} />
        <Kpi label="Subskrypcje" value={String(rows.length)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
        <table className="w-full min-w-[720px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-border bg-card/70 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Nazwa</th>
              <th className="w-[140px] px-3 py-2.5 text-right font-semibold">Kwota (PLN)</th>
              <th className="w-[150px] px-3 py-2.5 text-left font-semibold">Cykl</th>
              <th className="w-[130px] px-3 py-2.5 text-right font-semibold">Mies.</th>
              <th className="w-[130px] px-3 py-2.5 text-right font-semibold">Rocznie</th>
              <th className="w-[44px] px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  Brak subskrypcji — dodaj pierwszą poniżej.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const monthly = r.cycle === "MONTHLY" ? r.amountCents : r.amountCents / 12;
              const yearly = r.cycle === "MONTHLY" ? r.amountCents * 12 : r.amountCents;
              return (
                <tr key={r.id} className="group transition-colors hover:bg-accent/40">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        defaultValue={r.name}
                        placeholder="np. Figma, Slack…"
                        maxLength={200}
                        onBlur={(e) => {
                          if (e.target.value === r.name) return;
                          patchLocal(r.id, { name: e.target.value });
                          send(r.id, { name: e.target.value });
                        }}
                        className="h-9 w-full rounded-md bg-transparent px-2 font-medium outline-none transition-colors hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary/40"
                      />
                      {r.url && (
                        <a
                          href={r.url.startsWith("http") ? r.url : `https://${r.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                          title={r.url}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      inputMode="decimal"
                      defaultValue={r.amountCents ? (r.amountCents / 100).toFixed(2) : ""}
                      placeholder="0,00"
                      onBlur={(e) => {
                        const n = Number(e.target.value.replace(",", ".").replace(/\s/g, ""));
                        const cents = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
                        if (cents === r.amountCents) return;
                        patchLocal(r.id, { amountCents: cents });
                        send(r.id, { amountPln: e.target.value });
                      }}
                      className="h-9 w-full rounded-md bg-transparent px-2 text-right font-mono outline-none transition-colors hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary/40"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.cycle}
                      onChange={(e) => {
                        const cycle = e.target.value as Cycle;
                        patchLocal(r.id, { cycle });
                        send(r.id, { cycle });
                      }}
                      className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 text-[0.86rem] outline-none transition-colors hover:bg-background/60 focus:border-primary/40 focus:bg-background"
                    >
                      <option value="MONTHLY">Miesięcznie</option>
                      <option value="YEARLY">Rocznie</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[0.84rem] text-muted-foreground">
                    {fmtPln(monthly)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[0.84rem] text-muted-foreground">
                    {fmtPln(yearly)}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(r.id, r.name)}
                      aria-label="Usuń subskrypcję"
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-card/70 font-semibold">
                <td className="px-4 py-3" colSpan={3}>
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                    Suma ({rows.length})
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-primary">
                  {fmtPln(totals.monthly)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-primary">
                  {fmtPln(totals.yearly)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-transform hover:-translate-y-[1px]"
        >
          <Plus size={14} /> Dodaj subskrypcję
        </button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/40 p-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-display text-[1.6rem] font-bold ${highlight ? "bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function fmtPln(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
