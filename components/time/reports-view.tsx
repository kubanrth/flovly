"use client";

// E2 / segment „Raport" — zakres dat, przełącznik „tylko fakturowane", trzy
// kafle KPI i roll-upy wg osoby / zadania / tablicy z paskami udziału.

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import {
  DataFooter,
  DataTable,
  DataTd,
  DataTh,
  DataThead,
  DataTr,
} from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { plPlural } from "@/lib/pluralize";
import { TimeHeader } from "./time-header";
import {
  billableSeconds,
  csvRows,
  fmtDuration,
  pct,
  rollUp,
  sumSeconds,
  toCsv,
  type RollUp,
  type TimeEntryRow,
} from "./time-math";

const entryPl = (n: number) => plPlural(n, "wpis", "wpisy", "wpisów");

const CSV_BOM = "﻿";

export function ReportsView({
  workspaceId,
  from,
  to,
  billableOnly,
  entries,
}: {
  workspaceId: string;
  /** Zakres włącznie, `YYYY-MM-DD` — te same wartości co w `<input type="date">`. */
  from: string;
  to: string;
  billableOnly: boolean;
  entries: TimeEntryRow[];
}) {
  const router = useRouter();

  const total = sumSeconds(entries);
  const billable = billableSeconds(entries);

  const perUser = rollUp(entries, (e) => e.userId, (e) => e.userName);
  const perTask = rollUp(
    entries,
    (e) => e.taskId,
    (e) => `#${e.taskDisplayId ?? "?"} ${e.taskTitle ?? "—"}`,
  );
  const perBoard = rollUp(entries, (e) => e.boardId, (e) => e.boardName ?? "—");

  const csvHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_BOM + toCsv(csvRows(entries)))}`,
    [entries],
  );

  const apply = (patch: { from?: string; to?: string; billable?: boolean }) => {
    const q = new URLSearchParams({
      from: patch.from ?? from,
      to: patch.to ?? to,
      billable: String(patch.billable ?? billableOnly),
    });
    router.push(`/w/${workspaceId}/time/reports?${q.toString()}`);
  };

  return (
    <div data-ui="time-report" className="flex min-h-0 flex-1 flex-col bg-card">
      <TimeHeader
        workspaceId={workspaceId}
        tab="report"
        csvHref={csvHref}
        csvName={`raport-czasu-${from}_${to}.csv`}
      >
        <span className="flex items-center gap-2">
          <Input
            type="date"
            size="sm"
            aria-label="Od"
            value={from}
            onChange={(e) => apply({ from: e.target.value })}
            className="w-[132px]"
          />
          <span className="text-xs text-fg-3">–</span>
          <Input
            type="date"
            size="sm"
            aria-label="Do"
            value={to}
            onChange={(e) => apply({ to: e.target.value })}
            className="w-[132px]"
          />
          <Switch
            id="billable-only"
            checked={billableOnly}
            onCheckedChange={(next) => apply({ billable: next === true })}
            className="ml-2"
          />
          <label htmlFor="billable-only" className="cursor-pointer text-xs text-fg-2">
            tylko fakturowane
          </label>
        </span>
      </TimeHeader>

      <div className="flex shrink-0 gap-3 px-8 pb-3.5 max-md:flex-col max-md:px-4">
        <Kpi label="Suma czasu" value={fmtDuration(total)} meta={`${entries.length} ${entryPl(entries.length)}`} />
        <Kpi label="Zafakturowane" value={fmtDuration(billable)} meta={`${pct(billable, total)}%`} />
        <Kpi label="Osób w raporcie" value={String(perUser.length)} meta={perUser[0] ? `najwięcej: ${perUser[0].label}` : "—"} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pb-5 max-md:px-4">
        <ReportTable
          title="Wg osoby"
          head="Osoba"
          rows={perUser}
          total={total}
          renderLabel={(r) => (
            <span className="flex items-center gap-2">
              <Avatar name={r.label} size={22} />
              <span className="truncate">{r.label}</span>
            </span>
          )}
        />
        <ReportTable
          title="Wg zadania"
          head="Zadanie"
          rows={perTask.slice(0, 20)}
          total={total}
          renderLabel={(r) => (
            <Link
              href={`/w/${workspaceId}/t/${r.key}`}
              className="truncate rounded-[2px] text-orange-700 no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900"
            >
              {r.label}
            </Link>
          )}
        />
        <ReportTable
          title="Wg tablicy"
          head="Tablica"
          rows={perBoard}
          total={total}
          renderLabel={(r) => (
            <Link
              href={`/w/${workspaceId}/b/${r.key}/table`}
              className="truncate rounded-[2px] text-orange-700 no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900"
            >
              {r.label}
            </Link>
          )}
        />
      </div>

      <div className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 max-md:px-4">
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {from} – {to} · {entries.length} {entryPl(entries.length)} · {fmtDuration(total)}
          {billableOnly ? " · tylko fakturowane" : ""}
        </span>
      </div>
    </div>
  );
}

function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div data-ui="summary-kpi" className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3">
      <div className="mb-0.5 text-2xs text-fg-3">{label}</div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="font-mono text-lg font-semibold">{value}</span>
        <span className="truncate text-2xs text-fg-3">{meta}</span>
      </div>
    </div>
  );
}

function ReportTable({
  title,
  head,
  rows,
  total,
  renderLabel,
}: {
  title: string;
  head: string;
  rows: RollUp[];
  total: number;
  renderLabel: (row: RollUp) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="eyebrow">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <DataTable
        className="table-fixed"
        footer={
          <DataFooter>
            <span>{rows.length} {plPlural(rows.length, "pozycja", "pozycje", "pozycji")}</span>
            <span className="ml-auto">Σ {fmtDuration(rows.reduce((n, r) => n + r.seconds, 0))}</span>
          </DataFooter>
        }
      >
        <DataThead>
          <tr>
            <DataTh>{head}</DataTh>
            <DataTh width="45%">Udział</DataTh>
            <DataTh width={96} align="right">Czas</DataTh>
            <DataTh width={110} align="right">Fakturowane</DataTh>
          </tr>
        </DataThead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                Brak wpisów w tym zakresie.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <DataTr key={row.key}>
              <DataTd className="max-w-0 truncate text-xs">{renderLabel(row)}</DataTd>
              <DataTd>
                <span
                  className="block h-2 overflow-hidden rounded-[4px] bg-n-100"
                  role="img"
                  aria-label={`${pct(row.seconds, total)}% czasu`}
                >
                  <span className="block h-2 bg-orange-500" style={{ width: `${pct(row.seconds, total)}%` }} />
                </span>
              </DataTd>
              <DataTd align="right" className="font-mono text-xs font-semibold">{fmtDuration(row.seconds)}</DataTd>
              <DataTd align="right" className="font-mono text-xs text-muted-foreground">
                {fmtDuration(row.billableSeconds)}
              </DataTd>
            </DataTr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}
