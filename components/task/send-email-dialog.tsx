"use client";

import { useActionState, useState, startTransition, useEffect } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { IconMail } from "@/components/ui/icons";
import { sendTaskByEmailAction, type SendEmailState } from "@/app/(app)/w/[workspaceId]/t/email-actions";
import { attachmentPl } from "@/lib/pluralize";
import { formatBytes } from "@/components/task/attachments-section";

interface AttachmentOption { id: string; filename: string; sizeBytes: number }

export function SendEmailDialog({ taskId, taskTitle, attachments, iconOnly }: { taskId: string; taskTitle: string; attachments: AttachmentOption[]; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SendEmailState, FormData>(sendTaskByEmailAction, null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(attachments.map((a) => a.id)));

  // Auto-close on success; reset selection when reopened.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.ok) setOpen(false);
  }, [state?.ok]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setPicked(new Set(attachments.map((a) => a.id)));
  }, [open, attachments]);

  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const totalBytes = attachments.filter((a) => picked.has(a.id)).reduce((s, a) => s + a.sizeBytes, 0);

  return (
    <>
      <Button variant={iconOnly ? "ghost" : "secondary"} size="sm" iconOnly={iconOnly} aria-label="Wyślij mailem" title="Wyślij mailem" onClick={() => setOpen(true)}>
        <IconMail />{!iconOnly && "Wyślij mailem"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} key={open ? "open" : "closed"}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Wyślij zadanie mailem</DialogTitle>
            <DialogDescription>„{taskTitle}” — pełna karta zadania w HTML z wybranymi plikami. Limit 40 MB; większe pliki pójdą jako linki.</DialogDescription>
          </DialogHeader>
          <form action={(fd) => { fd.set("taskId", taskId); fd.set("attachmentIds", Array.from(picked).join(",")); startTransition(() => formAction(fd)); }} className="contents">
            <DialogBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">Adres odbiorcy</span>
                <Input type="email" name="recipientEmail" required autoFocus placeholder="imie@firma.pl" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">Wiadomość (opcjonalnie)</span>
                <Textarea name="note" rows={3} maxLength={2000} placeholder="Krótka notka od Ciebie — np. Proszę o akcept" />
              </label>
              {attachments.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Załączniki — {picked.size} z {attachments.length} {attachmentPl(attachments.length)} · {formatBytes(totalBytes)}</span>
                  <ul className="flex flex-col rounded-sm border border-border">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex h-8 items-center gap-2 border-b border-n-100 px-2 last:border-b-0">
                        <Checkbox checked={picked.has(a.id)} onCheckedChange={() => toggle(a.id)} ariaLabel={a.filename} />
                        <span className="min-w-0 flex-1 truncate text-sm">{a.filename}</span>
                        <span className="font-mono text-[10px] text-n-500">{formatBytes(a.sizeBytes)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {state?.ok === false && <p className="text-xs text-danger-text">{state.error}</p>}
              {state?.ok === true && <p className="text-xs text-success-text">{state.message}</p>}
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button>
              <Button type="submit" loading={pending}>{pending ? "Wysyłam…" : "Wyślij"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
