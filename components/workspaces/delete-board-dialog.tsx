"use client";

import { startTransition, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteBoardAction } from "@/app/(app)/w/[workspaceId]/b/actions";

// Replaces the native window.confirm that was firing when the user
// clicked the trash icon on a board in the sidebar. Centered modal
// with destructive styling so "usuń na zawsze" reads as final, not
// like every other blue button.
export function DeleteBoardDialog({
  workspaceId,
  boardId,
  boardName,
}: {
  workspaceId: string;
  boardId: string;
  boardName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirmDelete = () => {
    setPending(true);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    // deleteBoardAction redirects on success, so the dialog will
    // unmount as the router navigates. No explicit setOpen(false).
    startTransition(async () => {
      try {
        await deleteBoardAction(fd);
      } catch (err) {
        console.error("Delete board failed:", err);
        setPending(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Usuń tablicę ${boardName}`}
        title="Usuń tablicę"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground/70 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={10} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[460px] border-destructive/30"
        >
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"
                aria-hidden
              >
                <AlertTriangle size={18} />
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow text-destructive">Usuń tablicę</span>
                <DialogTitle className="font-display text-[1.4rem] font-bold leading-tight tracking-[-0.02em]">
                  Usunąć{" "}
                  <span className="text-brand-gradient">„{boardName}"</span>?
                </DialogTitle>
                <DialogDescription className="mt-1 text-[0.9rem] leading-[1.55]">
                  Tablica zniknie z sidebara i widoków workspace'u. Zadania,
                  statusy, linki i whiteboard zostaną w bazie — admin systemu
                  może przywrócić tablicę, ale z poziomu aplikacji nie da się
                  tego cofnąć.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-destructive px-4 font-sans text-[0.88rem] font-semibold text-destructive-foreground shadow-[0_6px_16px_-8px_rgba(220,38,38,0.45)] transition-[transform,opacity] duration-150 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <Trash2 size={14} />
              {pending ? "Usuwam…" : "Usuń tablicę"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
