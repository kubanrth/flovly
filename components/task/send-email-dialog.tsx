"use client";

import { useActionState, useState, startTransition } from "react";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  sendTaskByEmailAction,
  type SendEmailState,
} from "@/app/(app)/w/[workspaceId]/t/email-actions";
import { attachmentPl } from "@/lib/pluralize";

interface AttachmentOption {
  id: string;
  filename: string;
  sizeBytes: number;
}

export function SendEmailDialog({
  taskId,
  taskTitle,
  attachments,
}: {
  taskId: string;
  taskTitle: string;
  attachments: AttachmentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SendEmailState, FormData>(
    sendTaskByEmailAction,
    null,
  );
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(attachments.map((a) => a.id)),
  );

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalBytes = attachments
    .filter((a) => picked.has(a.id))
    .reduce((sum, a) => sum + a.sizeBytes, 0);

  return (
    <>
      {/* Klient (mobile screen): action triggery w nagłówku karty zadania
          były text-only muted i zlewały się ze sobą. Teraz colored pill:
          sky tint dla "Wyślij mailem" (mail = komunikacja, sky). h-8 daje
          32px hit-area na palca. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Emil's restraint: pill jest często klikany, więc transition-colors zamiast
// transform — active:scale-[0.97] daje tylko bardzo subtelny press feedback
// (~30ms percepcji) bez czytania jako "ozdobne". motion-reduce respect przez
// active:scale na transformie który prefers-reduced-motion neutralizuje.
className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 font-sans text-[0.78rem] font-semibold text-sky-700 transition-colors hover:border-sky-500/50 hover:bg-sky-500/15 active:scale-[0.97] motion-reduce:active:scale-100 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300"
      >
        <Mail size={12} /> Wyślij mailem
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card sm:max-w-[540px]">
          <DialogHeader>
            <span className="eyebrow">Wyślij zadanie</span>
            <DialogTitle className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              <span className="text-brand-gradient">Email</span> z tym zadaniem i
              załącznikami.
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              „{taskTitle}” — wyślemy pełną kartę zadania w HTML wraz z
              wybranymi plikami. Limit 40 MB na załączniki; większe pliki
              pójdą jako linki.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => {
              fd.set("taskId", taskId);
              fd.set("attachmentIds", Array.from(picked).join(","));
              startTransition(() => formAction(fd));
            }}
            className="mt-2 flex flex-col gap-5"
          >
            <label className="flex flex-col gap-2">
              <span className="eyebrow">Adres odbiorcy</span>
              <input
                type="email"
                name="recipientEmail"
                required
                autoFocus
                placeholder="imie@firma.pl"
                className="h-10 border-b border-border bg-transparent pb-1 font-sans text-[1rem] outline-none focus:border-primary"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Wiadomość (opcjonalnie)</span>
              <textarea
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="Krótka notka od Ciebie — np. 'Proszę o akcept'."
                className="min-h-[4rem] resize-none border-b border-border bg-transparent pb-1 font-sans text-[0.95rem] outline-none focus:border-primary"
              />
            </label>

            {attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="eyebrow">
                  Załączniki — {picked.size} z {attachments.length}{" "}
                  {attachmentPl(attachments.length)} · {formatBytes(totalBytes)}
                </span>
                <ul className="flex flex-col gap-1 rounded-lg border border-border bg-background p-1">
                  {attachments.map((a) => {
                    const on = picked.has(a.id);
                    return (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(a.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="flex-1 truncate text-[0.88rem]">
                            {a.filename}
                          </span>
                          <span className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground">
                            {formatBytes(a.sizeBytes)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {state?.ok === false && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}
            {state?.ok === true && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
                {state.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Wysyłam…" : "Wyślij"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
