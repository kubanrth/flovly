import Link from "next/link";
import { ArrowRight } from "lucide-react";

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

// Lista wszystkich osób z workspace'ów w których user jest ADMINEM (lub
// MEMBER'em — server decyduje). Pokazuje liczbę aktywnych tasków + zamknięte
// w tym miesiącu + link do widoku tasków przypisanych tej osobie w
// pierwszym dzielonym workspace.
export function TeamTasksTable({ rows }: { rows: TeamMemberRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-6 text-center text-[0.86rem] text-muted-foreground">
        Brak innych pracowników w Twoich workspace&apos;ach.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border bg-muted/50">
            <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2">Osoba</th>
              <th className="px-4 py-2">Aktywne zadania</th>
              <th className="px-4 py-2">Zamknięte w tym miesiącu</th>
              <th className="px-4 py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const initials = (r.name ?? r.email).slice(0, 2).toUpperCase();
              const display = r.name ?? r.email.split("@")[0];
              return (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
                        {r.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[0.9rem] font-medium">
                          {display}
                        </span>
                        <span className="truncate font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                          {r.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.86rem] tabular-nums">
                    {r.activeTaskCount}
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.86rem] tabular-nums">
                    {r.closedThisMonth}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.sharedWorkspaceId ? (
                      <Link
                        href={`/my-tasks?assignee=${r.id}`}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        Sprawdź <ArrowRight size={10} />
                      </Link>
                    ) : (
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/60">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
