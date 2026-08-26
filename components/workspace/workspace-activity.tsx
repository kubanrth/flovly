// C1 „Ostatnia aktywność w przestrzeni” — last audit-log entries of this
// workspace. Presentational; the page resolves actors, phrases and links.

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

export interface WorkspaceActivityEntry {
  id: string;
  actorName: string;
  actorAvatarUrl: string | null;
  /** Already conjugated verb phrase, e.g. „zaktualizował(a) zadanie”. */
  phrase: string;
  target: { label: string; href: string } | null;
  /** „wczoraj 16:40” */
  time: string;
}

export function WorkspaceActivity({ entries }: { entries: WorkspaceActivityEntry[] }) {
  return (
    <section aria-labelledby="ws-activity">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 id="ws-activity" className="eyebrow">
          Ostatnia aktywność w przestrzeni
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-1">
        {entries.length === 0 ? (
          <p className="flex min-h-[42px] items-center text-xs text-muted-foreground">Brak zdarzeń.</p>
        ) : (
          <ul>
            {entries.map((e, i) => (
              <li
                key={e.id}
                className={`flex min-h-[42px] items-center gap-2.5 ${i < entries.length - 1 ? "border-b border-n-100" : ""}`}
              >
                <Avatar name={e.actorName} src={e.actorAvatarUrl} size={24} className="shrink-0" />
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  <strong className="font-semibold text-foreground">{e.actorName}</strong> {e.phrase}
                  {e.target && (
                    <>
                      {" "}
                      <Link
                        href={e.target.href}
                        className="rounded-[2px] text-orange-700 outline-none hover:text-orange-800 hover:underline focus-visible:shadow-[var(--focus)] active:text-orange-900"
                      >
                        {e.target.label}
                      </Link>
                    </>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-n-500">{e.time}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
