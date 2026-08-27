"use client";

// Backupy: wiersz = przestrzeń, rozwinięcie = historia snapshotów z pobieraniem.
// Akcje serwerowe (`triggerWorkspaceBackupAction`, `triggerAllBackupsAction`,
// `getBackupDownloadUrlAction`) bez zmian — tu tylko warstwa widoku.

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  triggerWorkspaceBackupAction,
  triggerAllBackupsAction,
  getBackupDownloadUrlAction,
} from "@/app/(admin)/admin/backups/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconChevronDown, IconChevronRight, IconDownload, IconUndo } from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";

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

export function BackupsClient({ rows }: { rows: WorkspaceWithBackupsRow[] }) {
  const router = useRouter();
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const totalBackups = rows.reduce((sum, r) => sum + r.backups.length, 0);

  const runBulk = () => {
    if (!confirm("Zrobić backup wszystkich przestrzeni teraz?")) return;
    setBulkResult(null);
    startBulk(async () => {
      const r = await triggerAllBackupsAction();
      setBulkResult(`${r.created} utworzonych · ${r.failed} nieudanych · ${r.total} łącznie`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-2xs text-fg-2">
          {rows.length} {plPlural(rows.length, "przestrzeń", "przestrzenie", "przestrzeni")} ·{" "}
          {totalBackups} {plPlural(totalBackups, "backup", "backupy", "backupów")}
        </span>
        <span className="flex-1" />
        {bulkResult && <span className="font-mono text-2xs text-success-text">{bulkResult}</span>}
        <Button onClick={runBulk} disabled={bulkPending} loading={bulkPending}>
          <IconUndo width={14} height={14} />
          {bulkPending ? "Tworzenie…" : "Backup wszystkich teraz"}
        </Button>
      </div>

      <DataTable
        className="[--row-h:44px]"
        footer={
          <DataFooter>
            {totalBackups} {plPlural(totalBackups, "backup", "backupy", "backupów")} łącznie
          </DataFooter>
        }
      >
        <DataThead>
          <tr>
            <DataTh width={36} aria-label="Rozwiń" />
            <DataTh>Przestrzeń</DataTh>
            <DataTh width={160}>Ostatni backup</DataTh>
            <DataTh width={110} align="right">Liczba</DataTh>
            <DataTh width={110} align="right">Rozmiar</DataTh>
            <DataTh width={150} align="right">Akcje</DataTh>
          </tr>
        </DataThead>
        <tbody>
          {rows.map((row) => (
            <WorkspaceBlock
              key={row.id}
              row={row}
              open={openWorkspaceId === row.id}
              onToggle={() => setOpenWorkspaceId(openWorkspaceId === row.id ? null : row.id)}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2.5 py-10 text-center text-sm text-muted-foreground">
                Brak przestrzeni do backupowania.
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </div>
  );
}

function WorkspaceBlock({
  row,
  open,
  onToggle,
}: {
  row: WorkspaceWithBackupsRow;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [pending, startPending] = useTransition();
  const latest = row.backups[0];
  const totalBytes = row.backups.reduce((sum, b) => sum + b.sizeBytes, 0);

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
      <DataTr>
        <DataTd>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Zwiń historię ${row.name}` : `Rozwiń historię ${row.name}`}
            className="grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            {open ? <IconChevronDown width={13} height={13} /> : <IconChevronRight width={13} height={13} />}
          </button>
        </DataTd>
        <DataTd>
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{row.name}</span>
            {row.deletedAt && <Chip hue="red" size="sm">usunięta</Chip>}
          </span>
        </DataTd>
        <DataTd className="font-mono text-2xs text-muted-foreground">
          {latest ? formatDayKey(latest.dayKey) : "—"}
        </DataTd>
        <DataTd align="right" className="font-mono text-xs">{row.backups.length}</DataTd>
        <DataTd align="right" className="font-mono text-xs text-muted-foreground">{formatSize(totalBytes)}</DataTd>
        <DataTd align="right">
          <Button variant="secondary" size="sm" onClick={trigger} disabled={pending} loading={pending}>
            {pending ? "Tworzenie…" : "Backup teraz"}
          </Button>
        </DataTd>
      </DataTr>
      {open && (
        <tr>
          <td colSpan={6} className="border-b border-n-100 bg-canvas px-2.5 py-2">
            <BackupsList backups={row.backups} />
          </td>
        </tr>
      )}
    </>
  );
}

function BackupsList({ backups }: { backups: BackupRow[] }) {
  if (backups.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Brak backupów. Pierwszy powstanie przy najbliższym cronie albo po kliknięciu „Backup teraz”.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {backups.map((b) => (
        <BackupRowItem key={b.id} backup={b} />
      ))}
    </ul>
  );
}

function BackupRowItem({ backup }: { backup: BackupRow }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counts = backup.modelCounts;

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
    <li className="flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-1.5">
      <span className="text-xs font-medium">{formatDayKey(backup.dayKey)}</span>
      <span className="font-mono text-2xs text-muted-foreground">
        {new Date(backup.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} ·{" "}
        {formatSize(backup.sizeBytes)}
      </span>
      <span className="truncate font-mono text-2xs text-fg-3">
        {counts.boards ?? 0} tablic · {counts.tasks ?? 0} zadań · {counts.creativeBriefs ?? 0} pomysłów ·{" "}
        {counts.supportTickets ?? 0} zgłoszeń
      </span>
      <span className="ml-auto flex items-center gap-2">
        {error && <span className="font-mono text-2xs text-danger-text">{error}</span>}
        <Button variant="secondary" size="sm" onClick={download} disabled={downloading} loading={downloading}>
          <IconDownload width={12} height={12} />
          {downloading ? "…" : "Pobierz"}
        </Button>
      </span>
    </li>
  );
}

function formatDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  if (today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d) return "Dzisiaj";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.getFullYear() === y && yesterday.getMonth() === m - 1 && yesterday.getDate() === d) {
    return "Wczoraj";
  }
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
