"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Filter } from "lucide-react";
import { fmtDuration, fmtMoney } from "@/components/time/timesheet-view";

interface ReportEntry {
  id: string;
  durationSeconds: number;
  billable: boolean;
  rateSnapshotCents: number | null;
  note: string | null;
  approvedAt: string | null;
  startedAt: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskDisplayId: number | null;
  boardId: string | null;
  boardName: string | null;
}

export function ReportsView({
  workspaceId,
  rangeStartIso,
  rangeEndIso,
  billableOnly,
  entries,
}: {
  workspaceId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  billableOnly: boolean;
  entries: ReportEntry[];
}) {
  const router = useRouter();

  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);

  // Agregacje.
  const perUser = groupBy(entries, (e) => e.userId, (e) => e.userName);
  const perTask = groupBy(
    entries.filter((e) => e.taskId),
    (e) => e.taskId!,
    (e) =>
      `#${e.taskDisplayId ?? "?"} · ${e.taskTitle ?? "—"} (${e.boardName ?? "—"})`,
  );
  const perBoard = groupBy(
    entries.filter((e) => e.boardId),
    (e) => e.boardId!,
    (e) => e.boardName ?? "—",
  );

  const total = entries.reduce((a, e) => a + e.durationSeconds, 0);
  const billable = entries
    .filter((e) => e.billable)
    .reduce((a, e) => a + e.durationSeconds, 0);
  const earnings = entries.reduce((acc, e) => {
    if (!e.billable || !e.rateSnapshotCents) return acc;
    return acc + (e.durationSeconds / 3600) * e.rateSnapshotCents;
  }, 0);

  const csvHref = useMemo(() => {
    const rows = [
      [
        "id",
        "startedAt",
        "durationH",
        "user",
        "task",
        "board",
        "billable",
        "note",
        "approvedAt",
        "rateCents",
        "amountPln",
      ],
      ...entries.map((e) => [
        e.id,
        e.startedAt,
        (e.durationSeconds / 3600).toFixed(4),
        e.userName,
        e.taskTitle ?? "",
        e.boardName ?? "",
        e.billable ? "yes" : "no",
        (e.note ?? "").replace(/[\r\n,]/g, " "),
        e.approvedAt ?? "",
        e.rateSnapshotCents ?? "",
        e.billable && e.rateSnapshotCents
          ? ((e.durationSeconds / 3600) * (e.rateSnapshotCents / 100)).toFixed(2)
          : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [entries]);

  const updateFilter = (patch: {
    from?: string;
    to?: string;
    billable?: string;
  }) => {
    const q = new URLSearchParams();
    q.set("from", patch.from ?? rangeStartIso.slice(0, 10));
    q.set("to", patch.to ?? rangeEndIso.slice(0, 10));
    if (patch.billable ?? billableOnly ? "true" : undefined)
      q.set("billable", patch.billable ?? (billableOnly ? "true" : "false"));
    router.push(`/w/${workspaceId}/time/reports?${q.toString()}`);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-muted-foreground" />
          <label className="flex items-center gap-2 text-[0.82rem]">
            <span className="text-muted-foreground">Od:</span>
            <input
              type="date"
              defaultValue={rangeStartIso.slice(0, 10)}
              onChange={(e) => updateFilter({ from: e.target.value })}
              className="h-8 rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
            />
          </label>
          <label className="flex items-center gap-2 text-[0.82rem]">
            <span className="text-muted-foreground">Do:</span>
            <input
              type="date"
              defaultValue={rangeEndIso.slice(0, 10)}
              onChange={(e) => updateFilter({ to: e.target.value })}
              className="h-8 rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
            />
          </label>
          <label className="flex items-center gap-2 text-[0.82rem]">
            <input
              type="checkbox"
              checked={billableOnly}
              onChange={(e) =>
                updateFilter({ billable: e.target.checked ? "true" : "false" })
              }
              className="h-4 w-4"
            />
            Tylko billable
          </label>
        </div>
        <a
          href={csvHref}
          download={`timesheet-${rangeStartIso.slice(0, 10)}_${rangeEndIso.slice(0, 10)}.csv`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[0.82rem] hover:border-primary/60"
        >
          <Download size={13} /> CSV
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Suma czasu" value={fmtDuration(total)} />
        <Kpi label="Billable" value={fmtDuration(billable)} />
        <Kpi label="Wartość" value={fmtMoney(earnings)} highlight />
      </div>

      {/* Per user */}
      <ReportTable
        title="Wg użytkownika"
        rows={perUser.map((g) => ({
          key: g.key,
          label: g.label,
          seconds: g.seconds,
          amount: g.earnings,
          href: null,
        }))}
        totalSeconds={total}
      />

      {/* Per task */}
      <ReportTable
        title="Top zadania"
        rows={perTask
          .slice(0, 20)
          .map((g) => ({
            key: g.key,
            label: g.label,
            seconds: g.seconds,
            amount: g.earnings,
            href: `/w/${workspaceId}/t/${g.key}`,
          }))}
        totalSeconds={total}
      />

      {/* Per board */}
      <ReportTable
        title="Wg tablicy"
        rows={perBoard.map((g) => ({
          key: g.key,
          label: g.label,
          seconds: g.seconds,
          amount: g.earnings,
          href: `/w/${workspaceId}/b/${g.key}/table`,
        }))}
        totalSeconds={total}
      />
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

function ReportTable({
  title,
  rows,
  totalSeconds,
}: {
  title: string;
  rows: Array<{
    key: string;
    label: string;
    seconds: number;
    amount: number;
    href: string | null;
  }>;
  totalSeconds: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-[0.86rem]">
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => {
              const pct = totalSeconds > 0 ? (r.seconds / totalSeconds) * 100 : 0;
              return (
                <tr key={r.key} className="bg-card/30 hover:bg-card/60">
                  <td className="w-[46%] px-3 py-2">
                    {r.href ? (
                      <Link href={r.href} className="hover:text-primary">
                        {r.label}
                      </Link>
                    ) : (
                      <span>{r.label}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand-gradient"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="w-[14%] px-3 py-2 text-right font-mono">
                    {fmtDuration(r.seconds)}
                  </td>
                  <td className="w-[14%] px-3 py-2 text-right font-mono text-muted-foreground">
                    {r.amount > 0 ? fmtMoney(r.amount) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupBy(
  entries: ReportEntry[],
  key: (e: ReportEntry) => string,
  label: (e: ReportEntry) => string,
): Array<{ key: string; label: string; seconds: number; earnings: number }> {
  const map = new Map<
    string,
    { key: string; label: string; seconds: number; earnings: number }
  >();
  for (const e of entries) {
    const k = key(e);
    const existing = map.get(k) ?? {
      key: k,
      label: label(e),
      seconds: 0,
      earnings: 0,
    };
    existing.seconds += e.durationSeconds;
    if (e.billable && e.rateSnapshotCents) {
      existing.earnings += (e.durationSeconds / 3600) * (e.rateSnapshotCents / 100);
    }
    map.set(k, existing);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}
