"use client";

import { cloneElement, startTransition, useState, type ReactElement } from "react";
import { moveTaskToBoardAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input";
import { IconChevronRight, IconMove, IconSearch } from "@/components/ui/icons";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

export interface MoveTargetBoard { id: string; name: string; workspaceName: string }

// „Przenieś" — pick a target board in the workspace; status is matched by column name
// server-side (or cleared). After revalidate the task lands on top of the new board.
// `taskIds` — jedno zadanie z naglowka albo cale zaznaczenie z paska akcji
// masowych; akcja jest per zadanie, wiec przenosimy w petli (jak tagi w
// bulk-bar). `trigger` pozwala paskowi masowemu uzyc wlasnego przycisku.
export function MoveTaskMenu({ taskIds, currentBoardId, availableBoards, iconOnly, touch, trigger, onDone }: {
  taskIds: string[]; currentBoardId: string; availableBoards: MoveTargetBoard[]; iconOnly?: boolean; touch?: boolean;
  trigger?: ReactElement; onDone?: () => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const candidates = availableBoards.filter((b) => b.id !== currentBoardId).filter((b) => (q ? b.name.toLowerCase().includes(q) : true)).slice(0, 50);

  const submit = (targetBoardId: string) => {
    startTransition(async () => {
      for (const taskId of taskIds) {
        const fd = new FormData();
        fd.set("taskId", taskId);
        fd.set("targetBoardId", targetBoardId);
        await moveTaskToBoardAction(fd);
      }
      setOpen(false); setQuery(""); onDone?.();
    });
  };

  const triggerButton = trigger ?? (
    <Button
      variant={iconOnly ? "ghost" : "secondary"}
      size={touch ? "lg" : "sm"}
      iconOnly={iconOnly}
      className={touch ? "size-11 [&_svg]:size-[18px]" : undefined}
      aria-label="Przenieś"
      title="Przenieś zadanie do innej tablicy"
    />
  );

  const body = (mobile: boolean) => (
    <>
      <div className={cn("border-b border-border p-2", mobile && "px-4 py-3")}>
        <InputGroup
          leading={<IconSearch />}
          size={mobile ? "lg" : "sm"}
          // Na telefonie klawiatura zasłania listę, zanim ktokolwiek ją zobaczy.
          autoFocus={!mobile}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj tablicy…"
          aria-label="Szukaj tablicy"
        />
      </div>
      {candidates.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-fg-3">{q ? "Brak dopasowań." : "Brak innych tablic w przestrzeni."}</p>
      ) : (
        <ul className={cn("flex flex-col overflow-y-auto p-1", mobile ? "min-h-0 flex-1 px-2" : "max-h-[300px]")}>
          {candidates.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                data-board-id={b.id}
                onClick={() => submit(b.id)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-n-100 active:bg-n-200", mobile ? "min-h-12 px-3" : "h-9")}
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className={cn("truncate font-medium", mobile ? "text-base" : "text-sm")}>{b.name}</span>
                  <span className="truncate text-2xs text-fg-3">{b.workspaceName}</span>
                </span>
                <IconChevronRight width={12} height={12} className="text-fg-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={cn("border-t border-border px-3 py-2 text-2xs text-fg-3", mobile && "safe-bottom px-4 py-3")}>
        {taskIds.length > 1 ? `Przeniesione zostaną ${taskIds.length} zadania. ` : ""}Status zostanie dopasowany po nazwie albo wyczyszczony.
      </p>
    </>
  );

  // Telefon: arkusz od dołu. Popover kotwiczył się do ikony w pasku zadania,
  // wychodził poza ekran i zasłaniał nagłówek — nie dało się z niego korzystać.
  if (isMobile) {
    return (
      <>
        {trigger ? (
          cloneElement(trigger, { onClick: () => setOpen(true) } as Partial<typeof trigger.props>)
        ) : (
          <Button
            variant={iconOnly ? "ghost" : "secondary"}
            size={touch ? "lg" : "sm"}
            iconOnly={iconOnly}
            className={touch ? "size-11 [&_svg]:size-[18px]" : undefined}
            aria-label="Przenieś"
            title="Przenieś zadanie do innej tablicy"
            onClick={() => setOpen(true)}
          >
            <IconMove />{!iconOnly && "Przenieś"}
          </Button>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="max-h-[80dvh]" data-ui="move-task-sheet">
            <div className="sheet-drag-handle" aria-hidden="true" />
            <SheetTitle className="px-4 pt-2 pb-1 text-sm font-semibold">Przenieś do tablicy</SheetTitle>
            <div className="flex min-h-0 flex-1 flex-col">{body(true)}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={triggerButton}>
        <IconMove />{!iconOnly && "Przenieś"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        {body(false)}
      </PopoverContent>
    </Popover>
  );
}
