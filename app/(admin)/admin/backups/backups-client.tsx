"use client";

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  triggerWorkspaceBackupAction,
  triggerAllBackupsAction,
  getBackupDownloadUrlAction,
} from "@/app/(admin)/admin/backups/actions";

export interface BackupRow {
  id: string;
  dayKey: string;
  sizeBytes: number;
  modelCounts: Record<string, number>;
  createdAt: string;
}

export interface WorkspaceWithBackupsRow {
  id: string;
  name: string;
  deletedAt: string | null;
  backups: BackupRow[];
}

export function BackupsClient({
  rows,
}: {
  rows: WorkspaceWithBackupsRow[];
}) {
  const router = useRouter();
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const runBulk = () => {
    setBulkResult(null);
    startBulk(async () => {
      const r = await triggerAllBackupsAction();
      setBulkResult(
        `${r.created} utworzonych · ${r.failed} nieudanych · ${r.total} total`,
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {rows.length} przestrzeni · {rows.reduce((sum, r) => sum + r.backups.length, 0)} backupów łącznie
        </div>
        <div className="flex items-center gap-3">
          {bulkResult && (
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-primary">
              {bulkResult}
            </span>
          )}
          <button
            type="button"
            onClick={runBulk}
            disabled={bulkPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={13} className={bulkPending ? "animate-spin" : ""} />
            {bulkPending ? "Tworzenie…" : "Backup wszystkich teraz"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-muted/50">
            <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="w-8 px-2 py-2"></th>
              <th className="px-4 py-2">Przestrzeń</th>
              <th className="px-4 py-2">Ostatni backup</th>
              <th className="px-4 py-2 text-right">Liczba backupów</th>
              <th className="px-4 py-2 text-right">Suma rozmiaru</th>
              <th className="px-4 py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = openWorkspaceId === row.id;
              const latest = row.backups[0];
              const totalBytes = row.backups.reduce(
                (sum, b) => sum + b.sizeBytes,
                0,
              );
              return (
                <WorkspaceBlock
                  key={row.id}
                  row={row}
                  open={open}
                  latest={latest}
                  totalBytes={totalBytes}
                  onToggle={() =>
                    setOpenWorkspaceId(open ? null : row.id)
                  }
                />
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[0.86rem] text-muted-foreground"
                >
                  Brak workspace&apos;ów do backupowania.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkspaceBlock({
  row,
  open,
  latest,
  totalBytes,
  onToggle,
}: {
  row: WorkspaceWithBackupsRow;
  open: boolean;
  latest: BackupRow | undefined;
  totalBytes: number;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [pending, startPending] = useTransition();

  const trigger = () => {
    startPending(async () => {
      const fd = new FormData();
      fd.set("workspaceId", row.id);
      await triggerWorkspaceBackupAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Zwiń historię" : "Rozwiń historię"}
            className="grid h-6 w-6 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Database size={13} className="shrink-0 text-muted-foreground" />
            <span className="font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
              {row.name}
            </span>
            {row.deletedAt && (
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-destructive">
                usunięty
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-[0.78rem] text-muted-foreground">
          {latest ? formatDayKey(latest.dayKey) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-mono text-[0.84rem] tabular-nums">
          {row.backups.length}
        </td>
        <td className="px-4 py-3 text-right font-mono text-[0.78rem] text-muted-foreground tabular-nums">
          {formatSize(totalBytes)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={trigger}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={11} className={pending ? "animate-spin" : ""} />
            {pending ? "Tworzenie…" : "Backup teraz"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border last:border-b-0">
          <td colSpan={6} className="bg-muted/30 px-4 py-3">
            <BackupsList backups={row.backups} workspaceName={row.name} />
          </td>
        </tr>
      )}
    </>
  );
}

function BackupsList({
  backups,
  workspaceName,
}: {
  backups: BackupRow[];
  workspaceName: string;
}) {
  if (backups.length === 0) {
    return (
      <p className="py-4 text-center text-[0.84rem] text-muted-foreground">
        Brak backupów. Pierwszy zostanie utworzony przy najbliższym cron-ie
        albo po kliknięciu „Backup teraz".
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {backups.map((b) => (
        <BackupRowItem key={b.id} backup={b} workspaceName={workspaceName} />
      ))}
    </ul>
  );
}

function BackupRowItem({
  backup,
  workspaceName: _workspaceName,
}: {
  backup: BackupRow;
  workspaceName: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = backup.modelCounts;
  const sumStuff =
    (counts.boards ?? 0) +
    (counts.tasks ?? 0) +
    (counts.creativeBriefs ?? 0) +
    (counts.supportTickets ?? 0);

  const download = () => {
    setDownloading(true);
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await getBackupDownloadUrlAction({ backupId: backup.id });
        setDownloading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        window.open(res.url, "_blank", "noopener,noreferrer");
      })();
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md bg-background px-3 py-2 text-[0.84rem]">
      <Clock size={12} className="shrink-0 text-muted-foreground" />
      <span className="font-medium">{formatDayKey(backup.dayKey)}</span>
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        {new Date(backup.createdAt).toLocaleTimeString("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      <span className="font-mono text-[0.66rem] text-muted-foreground/70">·</span>
      <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
        {formatSize(backup.sizeBytes)}
      </span>
      <span className="font-mono text-[0.66rem] text-muted-foreground/70">·</span>
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
        {counts.boards ?? 0} boardów · {counts.tasks ?? 0} tasków · {counts.creativeBriefs ?? 0} briefów · {counts.supportTickets ?? 0} ticketów
        {sumStuff === 0 && " · pusty"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {error && (
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-destructive">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={11} />
          {downloading ? "…" : "Pobierz"}
        </button>
      </div>
    </li>
  );
}

function formatDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday =
    today.getFullYear() === y &&
    today.getMonth() === m - 1 &&
    today.getDate() === d;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === y &&
    yesterday.getMonth() === m - 1 &&
    yesterday.getDate() === d;
  if (isToday) return "Dzisiaj";
  if (isYesterday) return "Wczoraj";
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
