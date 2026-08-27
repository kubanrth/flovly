"use client";

// E9 — „Nowe zgłoszenie". Makieta E9 jest skrzynką przychodzącą i nie ma
// tworzenia ticketa, ale to istniejąca funkcja modułu, więc trafia do
// dialogu wywoływanego z nagłówka listy.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { IconAttachment, IconClose, IconUpload, IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  confirmSupportAttachmentUploadAction,
  createSupportTicketAction,
  requestSupportAttachmentUploadAction,
} from "@/app/(app)/w/[workspaceId]/support/actions";
import {
  ATTACHMENT_ACCEPT,
  PRIORITIES,
  PRIORITY_META,
  formatFileSize,
  inferContentType,
  type SupportPriority,
} from "./support-model";

export function NewTicketDialog({
  workspaceId,
  open,
  onOpenChange,
  onCreated,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticketId: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportPriority>("MEDIUM");
  const [isUrgent, setIsUrgent] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setIsUrgent(false);
    setDueAt("");
    setFiles([]);
    setError(null);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("priority", priority);
      fd.set("isUrgent", isUrgent ? "true" : "false");
      fd.set("dueAt", isUrgent ? "" : dueAt);
      const res = await createSupportTicketAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Załączniki idą równolegle; pojedyncza porażka nie kasuje zgłoszenia,
      // które już istnieje — użytkownik dorzuci plik z widoku zgłoszenia.
      if (files.length > 0) {
        await Promise.all(
          files.map(async (f) => {
            const ct = inferContentType(f);
            const req = await requestSupportAttachmentUploadAction(res.ticketId, f.name, ct, f.size);
            if (!req.ok) return;
            try {
              const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": ct }, body: f });
              if (!put.ok) return;
              await confirmSupportAttachmentUploadAction({
                ticketId: res.ticketId,
                storageKey: req.storageKey,
                filename: f.name,
                contentType: ct,
                sizeBytes: f.size,
              });
            } catch {
              /* pojedynczy plik — reszta leci dalej */
            }
          }),
        );
      }
      router.refresh();
      onCreated(res.ticketId);
      reset();
      onOpenChange(false);
    } catch {
      setError("Nie udało się utworzyć zgłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nowe zgłoszenie</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Temat</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="Krótko: o co chodzi"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Opis</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Co się dzieje, czego oczekujesz, co już sprawdzono…"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Priorytet</span>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={cn(
                    "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium outline-none",
                    priority === p
                      ? "border-control-on bg-control-on text-white"
                      : "border-border bg-card text-n-700 hover:bg-n-100 active:bg-n-200",
                  )}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Kiedy ma być zrobione</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsUrgent((v) => !v)}
                aria-pressed={isUrgent}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none",
                  isUrgent
                    ? "border-danger bg-chip-red-bg text-danger-text"
                    : "border-border bg-card text-n-700 hover:bg-n-100 active:bg-n-200",
                )}
              >
                <IconWarning width={12} height={12} />
                NATYCHMIAST
              </button>
              {!isUrgent && (
                <div className="min-w-[240px] flex-1">
                  <DateTimePicker
                    name="__dueAtPicker"
                    defaultValue={dueAt || null}
                    placeholder="Bez konkretnej daty"
                    onChange={setDueAt}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Załączniki</span>
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <IconUpload width={12} height={12} />
                Dodaj plik
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept={ATTACHMENT_ACCEPT}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (list.length > 0) setFiles((prev) => [...prev, ...list]);
                }}
              />
            </div>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1">
                {files.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5"
                  >
                    <IconAttachment width={12} height={12} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{f.name}</span>
                    <span className="shrink-0 font-mono text-2xs text-fg-3">{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      aria-label={`Usuń ${f.name} z listy`}
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-danger-text active:bg-n-200"
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="rounded-sm bg-chip-red-bg px-3 py-2 text-xs text-danger-text">{error}</p>
          )}

          {isUrgent && (
            <Chip hue="red" size="lg" className="self-start">
              Termin zostanie wyczyszczony — NATYCHMIAST ma pierwszeństwo.
            </Chip>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            loading={submitting}
            disabled={submitting || !title.trim() || !description.trim()}
          >
            Zgłoś
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
