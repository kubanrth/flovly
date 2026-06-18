import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock, Calendar as CalIcon, Eye, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import {
  PRIORITY_META,
  type TaskPriorityValue,
} from "@/lib/task-priority";
import { FlovlyMark } from "@/components/brand/flovly-logo";

// F12-K79: PUBLIC route — bez auth. Token w URL → fetchujemy tablicę read-only.
// Sprawdzamy: token istnieje, !revoked, !expired.
// Pozytywne wyświetlenie inkrementuje accessCount + ustawia lastAccessedAt.
//
// Layout: minimalny header (board name + workspace name + "Powered by FLOVLY"),
// grupowanie zadań po statusie (kanban-like), badge'e priorytetu, brak akcji.

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ token: string }>;

// Bumping accessCount jest mutacją wewnątrz page() — to działa w Next.js
// 16 bo page jest dynamic. await-ed po stronie response żeby user widział
// zawsze świeże dane (next render = +1).
async function trackAccess(linkId: string) {
  await db.boardShareLink.update({
    where: { id: linkId },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  });
}

export default async function ShareViewerPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!token || typeof token !== "string") notFound();

  const link = await db.boardShareLink.findUnique({
    where: { token },
    include: {
      board: {
        select: {
          id: true,
          name: true,
          description: true,
          deletedAt: true,
          workspace: { select: { name: true, slug: true } },
          statusColumns: { orderBy: { order: "asc" } },
          tasks: {
            where: { deletedAt: null },
            orderBy: [
              { statusColumn: { order: "asc" } },
              { rowOrder: "asc" },
            ],
            select: {
              id: true,
              displayId: true,
              title: true,
              statusColumnId: true,
              priority: true,
              startAt: true,
              stopAt: true,
              assignees: {
                select: {
                  user: { select: { name: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!link) notFound();
  if (link.revokedAt) {
    return <RevokedPage />;
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return <ExpiredPage />;
  }
  if (link.board.deletedAt) notFound();

  // Fire-and-forget access tracking (nie blokujemy render'u jeśli sypnie).
  void trackAccess(link.id);

  const board = link.board;
  const tasksByStatus = new Map<string | null, typeof board.tasks>();
  for (const t of board.tasks) {
    const key = t.statusColumnId;
    const bucket = tasksByStatus.get(key) ?? [];
    bucket.push(t);
    tasksByStatus.set(key, bucket);
  }

  return (
    // Mobile v4 (B10 — Public viewer): pb-16 so sticky watermark doesn't overlap content.
    <div className="min-h-screen bg-background pb-16 text-foreground md:pb-0">
      {/* Minimal brand header. Mobile: sticky w/ view-only badge top per spec. */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur md:static md:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <FlovlyMark size={32} className="shadow-brand rounded-[10px] md:h-9 md:w-9" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground md:text-[0.62rem]">
                {board.workspace.name}
              </span>
              <h1 className="truncate font-display text-[1rem] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[1.15rem] md:leading-none">
                {board.name}
              </h1>
            </div>
          </div>
          {/* Read-only badge — pill on mobile (>=44px touch even though non-interactive). */}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-primary md:border-transparent md:bg-transparent md:px-0 md:py-0 md:font-normal md:text-muted-foreground">
            <Eye size={11} />
            <span className="hidden sm:inline">Podgląd · read-only</span>
            <span className="sm:hidden">Read-only</span>
          </span>
        </div>
        {board.description && (
          <div className="mx-auto max-w-7xl px-4 pb-3 md:px-6 md:pb-4">
            <p className="max-w-[64ch] text-[0.86rem] leading-[1.55] text-muted-foreground md:text-[0.92rem]">
              {board.description}
            </p>
          </div>
        )}
      </header>

      {/* Tasks grouped by status (kanban-like) */}
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {board.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="font-display text-[1.05rem] font-semibold text-foreground">
              Tablica jest pusta
            </p>
            <p className="mt-1 text-[0.88rem] text-muted-foreground">
              Brak zadań do wyświetlenia.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {board.statusColumns.map((col) => {
              const tasks = tasksByStatus.get(col.id) ?? [];
              return (
                <ReadOnlyColumn
                  key={col.id}
                  name={col.name}
                  color={col.colorHex}
                  tasks={tasks}
                />
              );
            })}
            {/* No-status bucket */}
            {(tasksByStatus.get(null)?.length ?? 0) > 0 && (
              <ReadOnlyColumn
                name="Bez statusu"
                color="#94A3B8"
                tasks={tasksByStatus.get(null) ?? []}
              />
            )}
          </div>
        )}
      </main>

      {/* Desktop: inline footer. Mobile: sticky bottom watermark per Mobile v4 (B10). */}
      <footer className="mx-auto mt-8 hidden max-w-7xl px-6 py-6 text-center md:block">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Powered by <span className="text-brand-gradient font-semibold">FLOVLY</span>
          <ExternalLink size={10} />
        </Link>
      </footer>

      {/* Mobile sticky watermark — fixed bottom strip with brand mark. Read-only signal. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/90 backdrop-blur md:hidden">
        <div
          className="flex items-center justify-center gap-1.5 px-4"
          style={{ minHeight: "48px", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Udostępnione przez{" "}
            <span className="text-brand-gradient font-semibold">FLOVLY</span>
            <ExternalLink size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────── Read-only column ──────────────────────────────────────────────

function ReadOnlyColumn({
  name,
  color,
  tasks,
}: {
  name: string;
  color: string;
  tasks: {
    id: string;
    displayId: number;
    title: string;
    priority: TaskPriorityValue;
    startAt: Date | null;
    stopAt: Date | null;
    assignees: {
      user: { name: string | null; email: string; avatarUrl: string | null };
    }[];
  }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <h3 className="flex-1 font-display text-[0.95rem] font-semibold text-foreground">
          {name}
        </h3>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <li className="rounded-md border border-dashed border-border/50 px-2 py-4 text-center text-[0.72rem] text-muted-foreground/70">
            —
          </li>
        ) : (
          tasks.map((task) => <ReadOnlyTaskCard key={task.id} task={task} />)
        )}
      </ul>
    </div>
  );
}

// ─────────── Read-only task card ───────────────────────────────────────────

function ReadOnlyTaskCard({
  task,
}: {
  task: {
    displayId: number;
    title: string;
    priority: TaskPriorityValue;
    startAt: Date | null;
    stopAt: Date | null;
    assignees: {
      user: { name: string | null; email: string; avatarUrl: string | null };
    }[];
  };
}) {
  const priorityMeta =
    task.priority !== "NONE" ? PRIORITY_META[task.priority] : null;

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        {priorityMeta && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: priorityMeta.dotColor }}
            title={`Priorytet: ${priorityMeta.label}`}
          />
        )}
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
          #{task.displayId}
        </span>
        {priorityMeta && (
          <span
            className={`ml-auto inline-flex h-4 items-center rounded-full px-1.5 font-mono text-[0.54rem] uppercase tracking-[0.1em] ${priorityMeta.color} ${priorityMeta.bg}`}
          >
            {priorityMeta.shortCode}
          </span>
        )}
      </div>
      <p className="line-clamp-3 text-[0.86rem] font-medium leading-snug text-foreground">
        {task.title}
      </p>
      <div className="flex items-center gap-2 pt-1">
        {task.assignees.slice(0, 3).map((a, i) => (
          <span
            key={i}
            className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-[0.5rem] font-bold text-white"
            title={a.user.name ?? a.user.email}
          >
            {a.user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (a.user.name ?? a.user.email).slice(0, 2).toUpperCase()
            )}
          </span>
        ))}
        {task.stopAt && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground">
            <CalIcon size={9} />
            {task.stopAt.toLocaleDateString("pl-PL", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </li>
  );
}

// ─────────── Error states ──────────────────────────────────────────────────

function RevokedPage() {
  return <StateMessage icon={<Lock size={32} />} title="Dostęp cofnięty" body="Ten link już nie działa. Skontaktuj się z osobą, która Ci go udostępniła." />;
}

function ExpiredPage() {
  return <StateMessage icon={<CalIcon size={32} />} title="Link wygasł" body="Ten podgląd przestał być aktualny. Poproś o nowy link." />;
}

function StateMessage({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="flex max-w-[480px] flex-col items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h1 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        <p className="text-[0.95rem] leading-[1.55] text-muted-foreground">
          {body}
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Powered by <span className="text-brand-gradient font-semibold">FLOVLY</span>
        </Link>
      </div>
    </div>
  );
}
