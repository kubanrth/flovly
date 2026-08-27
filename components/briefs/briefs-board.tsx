"use client";

// E8 „Creative Board" — siatka 3 kolumn kart pomysłów, segmenty
// Najpopularniejsze / Najnowsze / Zrealizowane i kafel „Masz pomysł?".
// Bez głosowania kropkami (OMITTED.md / MAP D7).

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconCreative, IconPlus } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { NewBriefForm } from "@/components/briefs/new-brief-form";
import {
  BRIEF_SEGMENTS,
  STATUS_HUE,
  STATUS_LABEL,
  isRealised,
  selectBriefs,
  type BriefLite,
  type BriefSegment,
} from "@/components/briefs/brief-segments";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

export interface BriefCardData extends BriefLite {
  title: string;
  excerpt: string;
  emoji: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  /** Zadanie o tym samym tytule w tej przestrzeni — efekt „Zrób zadanie". */
  task: { id: string; displayId: number } | null;
}

const DATE_SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

export function BriefsBoard({
  workspaceId,
  briefs,
  taskBoardId,
}: {
  workspaceId: string;
  briefs: BriefCardData[];
  /**
   * Tablica, na której lądują zadania z pomysłów. `null` = brak tablic
   * w przestrzeni albo rola bez prawa tworzenia zadań — przycisk znika.
   */
  taskBoardId: string | null;
}) {
  const [segment, setSegment] = useState<BriefSegment>("top");
  const visible = selectBriefs(briefs, segment);
  const doneCount = briefs.filter((b) => isRealised(b.status)).length;

  return (
    <div
      data-ui="briefs"
      className="flex min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Creative Board</h1>
        <span className="text-xs text-muted-foreground">pomysły zespołu</span>
        <span className="flex-1" />
        <NewBriefForm workspaceId={workspaceId} />
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <Segmented
          aria-label="Filtr pomysłów"
          value={segment}
          onChange={setSegment}
          options={BRIEF_SEGMENTS}
        />
        <span className="flex-1" />
        <span className="font-mono text-2xs text-fg-3">
          {visible.length} {plPlural(visible.length, "pomysł", "pomysły", "pomysłów")} w tym widoku
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4 max-md:px-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <BriefCard key={b.id} workspaceId={workspaceId} brief={b} taskBoardId={taskBoardId} />
          ))}
          <NewBriefForm
            workspaceId={workspaceId}
            trigger={
              <button
                type="button"
                className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-n-400 p-3.5 text-muted-foreground outline-none hover:border-orange-500 hover:bg-selected hover:text-foreground active:bg-orange-100"
              >
                <IconCreative width={18} height={18} aria-hidden />
                <span className="text-sm font-medium">Masz pomysł? Dodaj kartę</span>
              </button>
            }
          />
        </div>
      </div>

      <footer
        data-ui="briefs-footer"
        className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-fg-2 max-md:px-4"
      >
        {briefs.length} {plPlural(briefs.length, "pomysł", "pomysły", "pomysłów")} ·{" "}
        {doneCount} {plPlural(doneCount, "zrealizowany", "zrealizowane", "zrealizowanych")}
      </footer>
    </div>
  );
}

function BriefCard({
  workspaceId,
  brief,
  taskBoardId,
}: {
  workspaceId: string;
  brief: BriefCardData;
  taskBoardId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const done = isRealised(brief.status);

  // „Zrób zadanie" — zwykłe `createTaskAction` z tytułem pomysłu; powiązanie
  // czytamy z powrotem po tytule (schemat nie ma pola na relację, patrz OMITTED).
  const makeTask = () => {
    if (!taskBoardId) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", taskBoardId);
    fd.set("title", brief.title);
    setPending(true);
    setError(false);
    startTransition(async () => {
      try {
        const res = await createTaskAction(null, fd);
        if (!res?.ok) setError(true);
        else router.refresh();
      } catch {
        // Odmowa uprawnień albo limit — komunikat zamiast wyjątku w konsoli.
        setError(true);
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <article
      data-ui="brief-card"
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5",
        done && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2">
        <Chip hue={STATUS_HUE[brief.status]} dot={done} size="sm">
          {STATUS_LABEL[brief.status]}
        </Chip>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-fg-3">
          {new Date(brief.updatedAt).toLocaleDateString("pl-PL", DATE_SHORT)}
        </span>
      </div>

      <Link
        href={`/w/${workspaceId}/briefs/${brief.id}`}
        className="text-base font-semibold leading-[19px] text-foreground outline-none hover:text-orange-800 hover:underline"
      >
        {brief.emoji && <span className="mr-1.5">{brief.emoji}</span>}
        {brief.title}
      </Link>

      {brief.excerpt !== "" && (
        <p className="line-clamp-3 text-xs leading-[18px] text-muted-foreground">{brief.excerpt}</p>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-n-100 pt-2">
        <Avatar name={brief.authorName} src={brief.authorAvatarUrl} size={20} />
        {brief.task ? (
          <Link
            href={`/w/${workspaceId}/t/${brief.task.id}`}
            className="ml-auto font-mono text-[10px] text-fg-3 outline-none hover:text-orange-800 hover:underline"
          >
            → zadanie #{brief.task.displayId}
          </Link>
        ) : taskBoardId ? (
          <span className="ml-auto flex items-center gap-2">
            {error && <span className="font-mono text-[10px] text-danger-text">nie udało się</span>}
            <Button size="sm" onClick={makeTask} disabled={pending} loading={pending}>
              Zrób zadanie
            </Button>
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-fg-3">
            <IconPlus width={10} height={10} aria-hidden /> brak tablicy
          </span>
        )}
      </div>
    </article>
  );
}
