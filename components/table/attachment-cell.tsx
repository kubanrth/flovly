"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Paperclip, Trash2, Upload, X } from "lucide-react";
import {
  confirmAttachmentUploadAction,
  deleteAttachmentAction,
  getAttachmentDownloadUrlAction,
  requestAttachmentUploadAction,
} from "@/app/(app)/w/[workspaceId]/t/attachment-actions";

// Kolumna 'Załączniki' w Tabeli — pokazuje licznik + popover z
// listą plików i uploadem. Reuse'uje 3-step signed-URL flow z
// AttachmentsSection (request → PUT → confirm) bez pobierania całego
// task-detail panelu.
const MAX_BYTES = 25 * 1024 * 1024;

export interface AttachmentCellItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export function AttachmentCell({
  taskId,
  attachments,
  canEdit,
}: {
  taskId: string;
  attachments: AttachmentCellItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Position popover beneath trigger via fixed coords (escapes table cell
  // overflow-clip). Recompute on open + on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: r.bottom + 6,
        left: Math.max(8, r.left),
        width: Math.max(280, r.width),
      });
    };
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  // Outside-click + escape close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const popover = document.getElementById(
        `attachment-popover-${taskId}`,
      );
      if (popover?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, taskId]);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setError(`Plik "${file.name}" przekracza 25 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const req = await requestAttachmentUploadAction({
          taskId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (!req.ok) {
          setError(req.error);
          continue;
        }
        const put = await fetch(req.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: file,
        });
        if (!put.ok) {
          setError(`Upload "${file.name}" nie powiódł się (${put.status}).`);
          continue;
        }
        const confirm = await confirmAttachmentUploadAction({
          taskId,
          storageKey: req.storageKey,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (!confirm.ok) {
          setError(confirm.error);
          continue;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd uploadu.");
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    router.refresh();
  };

  const download = async (id: string) => {
    const res = await getAttachmentDownloadUrlAction({ id });
    if (res.ok) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Usunąć załącznik?")) return;
    const fd = new FormData();
    fd.set("id", id);
    await deleteAttachmentAction(fd);
    router.refresh();
  };

  const count = attachments.length;
  const hasFiles = count > 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-accent ${
          hasFiles ? "text-foreground" : "text-muted-foreground"
        }`}
        title={
          hasFiles
            ? `${count} ${count === 1 ? "załącznik" : count < 5 ? "załączniki" : "załączników"}`
            : canEdit
              ? "Dodaj załącznik"
              : "Brak załączników"
        }
      >
        <Paperclip size={13} className="shrink-0" />
        {hasFiles ? (
          <span className="font-mono text-[0.74rem] tabular-nums">{count}</span>
        ) : (
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground/70">
            {canEdit ? "+ dodaj" : "—"}
          </span>
        )}
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={`attachment-popover-${taskId}`}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              // zIndex 200 === Z.popoverInModal (F12-K104) — portalled, używany w drawer.
              zIndex: 200,
            }}
            className="rounded-xl border border-border bg-popover p-2 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Załączniki ({count})
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
                className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>

            {attachments.length > 0 && (
              <ul className="mb-2 flex flex-col gap-0.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[0.82rem] hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => download(a.id)}
                      className="min-w-0 flex-1 truncate text-left transition-colors hover:text-primary"
                      title={a.filename}
                    >
                      {a.filename}
                    </button>
                    <span className="shrink-0 font-mono text-[0.6rem] text-muted-foreground/70">
                      {formatSize(a.sizeBytes)}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        aria-label="Usuń załącznik"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background py-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                <Upload size={11} />
                Dodaj plik
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />

            {uploading.length > 0 && (
              <p className="mt-2 px-1 font-mono text-[0.62rem] text-muted-foreground">
                Wysyłanie: {uploading.join(", ")}…
              </p>
            )}
            {error && (
              <p className="mt-2 px-1 text-[0.74rem] text-destructive">{error}</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
