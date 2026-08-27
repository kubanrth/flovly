import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SYSTEM_FLAGS } from "@/lib/system-flags";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { APP_NAME, Mark } from "@/components/brand/mark";
import { AvatarStack } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { hueForColor } from "@/components/ui/status-hue";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconCalendar, IconEye, IconLock } from "@/components/ui/icons";
import { PriorityIcon, PRIORITY_LABEL, type PriorityLevel } from "@/components/ui/priority-icon";
import { taskPl } from "@/lib/pluralize";

// F12-K79: PUBLICZNA trasa — bez auth. Token z URL → tablica tylko do odczytu.
// Warunki dostępu (wszystkie po stronie serwera): flaga `public_share_links`,
// token istnieje, !revoked, !expired, tablica nieusunięta. Renderujemy wyłącznie
// to, co link i tak udostępnia (zadania tablicy) — zero akcji, zero danych konta.
//
// F6 (redesign v5): kanban zastąpiony tabelą read-only (`DataTable`) + baner.

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ token: string }>;

const LEVEL: Record<TaskPriorityValue, PriorityLevel | null> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: null,
};

// Bumping accessCount jest mutacją wewnątrz page() — działa, bo page jest dynamic.
async function trackAccess(linkId: string) {
  await db.boardShareLink.update({
    where: { id: linkId },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  });
}

// Flaga systemowa czytana serwerowo; brak wiersza = wartość domyślna z katalogu.
async function sharingEnabled(): Promise<boolean> {
  const row = await db.systemFlag.findUnique({
    where: { key: "public_share_links" },
    select: { value: true },
  });
  if (row?.value === undefined || row.value === null) {
    return SYSTEM_FLAGS.public_share_links.defaultValue;
  }
  return row.value === true || row.value === "true";
}

export default async function ShareViewerPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!token || typeof token !== "string") notFound();
  if (!(await sharingEnabled())) notFound();

  const link = await db.boardShareLink.findUnique({
    where: { token },
    include: {
      board: {
        select: {
          name: true,
          description: true,
          deletedAt: true,
          workspace: { select: { name: true } },
          statusColumns: { orderBy: { order: "asc" }, select: { id: true, name: true, colorHex: true } },
          tasks: {
            where: { deletedAt: null },
            orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
            select: {
              id: true,
              displayId: true,
              title: true,
              statusColumnId: true,
              priority: true,
              stopAt: true,
              assignees: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
            },
          },
        },
      },
    },
  });

  if (!link) notFound();
  if (link.revokedAt) {
    return (
      <StateMessage
        icon={<IconLock width={20} height={20} />}
        title="Dostęp cofnięty"
        body="Ten link już nie działa. Skontaktuj się z osobą, która Ci go udostępniła."
      />
    );
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return (
      <StateMessage
        icon={<IconCalendar width={20} height={20} />}
        title="Link wygasł"
        body="Ten podgląd przestał być aktualny. Poproś o nowy link."
      />
    );
  }
  if (link.board.deletedAt) notFound();

  // Fire-and-forget — licznik odsłon nie może blokować renderu.
  void trackAccess(link.id);

  const board = link.board;
  const statusById = new Map(board.statusColumns.map((c) => [c.id, c]));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center gap-2.5 border-b border-border bg-card px-6 py-2.5 max-md:px-4">
        <Mark size={22} />
        <div className="min-w-0">
          <div className="truncate text-2xs text-fg-3">{board.workspace.name}</div>
          <h1 className="truncate text-sm font-semibold text-foreground">{board.name}</h1>
        </div>
        <Chip hue="gray" size="lg" className="ml-auto">
          <IconEye width={12} height={12} />
          Tylko podgląd
        </Chip>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4 max-md:px-4">
        <div
          data-ui="share-banner"
          className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800"
        >
          <IconEye width={14} height={14} className="mt-0.5 shrink-0" />
          <p>
            Publiczny podgląd tablicy — tylko do odczytu. Edycja, komentarze i szczegóły zadań są
            niedostępne bez konta.
          </p>
        </div>

        {board.description && (
          <p className="max-w-[72ch] text-xs text-muted-foreground">{board.description}</p>
        )}

        {board.tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input-border px-6 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">Tablica jest pusta</p>
            <p className="mt-1 text-xs text-muted-foreground">Brak zadań do wyświetlenia.</p>
          </div>
        ) : (
          <DataTable
            wrapperClassName="min-h-0 bg-card"
            footer={
              <DataFooter>
                {board.tasks.length} {taskPl(board.tasks.length)}
              </DataFooter>
            }
          >
            <DataThead>
              <tr>
                <DataTh width={64}>#</DataTh>
                <DataTh>Zadanie</DataTh>
                <DataTh width={150}>Status</DataTh>
                <DataTh width={130}>Priorytet</DataTh>
                <DataTh width={110}>Osoby</DataTh>
                <DataTh width={120}>Termin</DataTh>
              </tr>
            </DataThead>
            <tbody>
              {board.tasks.map((task) => {
                const status = task.statusColumnId ? statusById.get(task.statusColumnId) : undefined;
                const level = LEVEL[task.priority as TaskPriorityValue];
                return (
                  <DataTr key={task.id}>
                    <DataTd className="font-mono text-2xs text-muted-foreground">
                      {task.displayId}
                    </DataTd>
                    <DataTd className="font-medium text-foreground">{task.title}</DataTd>
                    <DataTd>
                      {status ? (
                        <Chip hue={hueForColor(status.colorHex)} dot>
                          {status.name}
                        </Chip>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </DataTd>
                    <DataTd>
                      {level === null ? (
                        <span className="text-n-400">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <PriorityIcon level={level} size={14} />
                          {PRIORITY_LABEL[level]}
                        </span>
                      )}
                    </DataTd>
                    <DataTd>
                      {task.assignees.length === 0 ? (
                        <span className="text-n-400">—</span>
                      ) : (
                        <AvatarStack
                          size={22}
                          people={task.assignees.map((a) => ({
                            name: a.user.name ?? a.user.email,
                            src: a.user.avatarUrl,
                          }))}
                        />
                      )}
                    </DataTd>
                    <DataTd className="font-mono text-2xs text-muted-foreground">
                      {task.stopAt
                        ? task.stopAt.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" })
                        : "—"}
                    </DataTd>
                  </DataTr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </main>

      <footer className="px-6 py-4 text-center text-2xs text-fg-3 max-md:px-4">
        Udostępnione przez <span className="font-semibold">{APP_NAME}</span>
      </footer>
    </div>
  );
}

function StateMessage({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="surface flex w-[400px] max-w-full flex-col items-center gap-2 p-6">
        <span className="grid size-9 place-items-center rounded-lg bg-n-100 text-muted-foreground">
          {icon}
        </span>
        <h1 className="text-md font-semibold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{body}</p>
        <p className="mt-2 text-2xs text-fg-3">
          Udostępnione przez <span className="font-semibold">{APP_NAME}</span>
        </p>
      </div>
    </div>
  );
}
