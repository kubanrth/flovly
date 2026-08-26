import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconArrowRight } from "@/components/ui/icons";

export interface TeamMemberRow {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  activeTaskCount: number;
  closedThisMonth: number;
  // Workspace context for the "Sprawdź" link — first shared workspace where
  // both the current user and the listed teammate are members.
  sharedWorkspaceId: string | null;
}

// Lista wszystkich osób z workspace'ów w których user jest ADMINEM.
// Aktywne zadania + zamknięte w tym miesiącu + link do widoku zadań osoby.
export function TeamTasksTable({ rows }: { rows: TeamMemberRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
        Brak innych pracowników w Twoich przestrzeniach.
      </p>
    );
  }

  return (
    <DataTable
      className="min-w-[640px]"
      footer={<DataFooter>{rows.length} os.</DataFooter>}
    >
      <DataThead>
        <tr>
          <DataTh>Osoba</DataTh>
          <DataTh width={140}>Aktywne zadania</DataTh>
          <DataTh width={180}>Zamknięte w tym miesiącu</DataTh>
          <DataTh width={120} align="right">Akcje</DataTh>
        </tr>
      </DataThead>
      <tbody>
        {rows.map((r) => {
          const display = r.name ?? r.email.split("@")[0] ?? r.email;
          return (
            <DataTr key={r.id} className="h-11">
              <DataTd>
                <div className="flex items-center gap-2.5">
                  <Avatar name={display} src={r.avatarUrl} size={28} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{display}</span>
                    <span className="truncate text-2xs text-fg-3">{r.email}</span>
                  </div>
                </div>
              </DataTd>
              <DataTd className="font-mono tabular-nums">{r.activeTaskCount}</DataTd>
              <DataTd className="font-mono tabular-nums">{r.closedThisMonth}</DataTd>
              <DataTd align="right">
                {r.sharedWorkspaceId ? (
                  <Link
                    href={`/my-tasks?user=${r.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground no-underline outline-none hover:bg-n-100 active:bg-n-200"
                  >
                    Sprawdź <IconArrowRight width={11} height={11} />
                  </Link>
                ) : (
                  <span className="font-mono text-2xs text-fg-3">—</span>
                )}
              </DataTd>
            </DataTr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
