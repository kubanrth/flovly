"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmAttachmentUploadAction,
  deleteAttachmentAction,
  getAttachmentDownloadUrlAction,
  requestAttachmentUploadAction,
} from "@/app/(app)/w/[workspaceId]/t/attachment-actions";
import { Button } from "@/components/ui/button";
import { IconClose, IconDownload, IconFile, IconTrash } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface AttachmentItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploader: { id: string; name: string | null; email: string; avatarUrl: string | null };
  createdAt: string;
  isUploader: boolean;
  thumbnailUrl: string | null;
}

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const limitFor = (mime: string) => (mime.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_BYTES);
const isSvg = (mime: string) => mime === "image/svg+xml";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// B2 Załączniki · N: 120×80 image thumbs, 32px rows for other files, dashed drop zone.
// SVG is download-only (never rendered as a document — script execution risk).
export function AttachmentsSection({ taskId, attachments, canUpload, canModerate }: { taskId: string; attachments: AttachmentItem[]; canUpload: boolean; canModerate: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      const mime = file.type || "application/octet-stream";
      if (file.size > limitFor(mime)) { setError(`Plik „${file.name}" przekracza ${Math.round(limitFor(mime) / 1048576)} MB.`); continue; }
      setUploading((u) => [...u, file.name]);
      try {
        const req = await requestAttachmentUploadAction({ taskId, filename: file.name, mimeType: mime, sizeBytes: file.size });
        if (!req.ok) { setError(req.error); continue; }
        const put = await fetch(req.signedUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: file });
        if (!put.ok) { setError(`Upload „${file.name}" nie powiódł się (${put.status}).`); continue; }
        const confirm = await confirmAttachmentUploadAction({ taskId, storageKey: req.storageKey, filename: file.name, mimeType: mime, sizeBytes: file.size });
        if (!confirm.ok) { setError(confirm.error); continue; }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd uploadu.");
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    router.refresh();
  };

  const images = attachments.filter((a) => a.thumbnailUrl);
  const files = attachments.filter((a) => !a.thumbnailUrl);
  const dropProps = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true); },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files); },
      }
    : {};

  return (
    <section className="flex flex-col gap-2" data-ui="task-attachments" {...dropProps}>
      <span className="eyebrow">Załączniki{attachments.length > 0 ? ` · ${attachments.length}` : ""}</span>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => <Thumb key={a.id} attachment={a} canDelete={a.isUploader || canModerate} />)}
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((a) => <FileRow key={a.id} attachment={a} canDelete={a.isUploader || canModerate} />)}
        </ul>
      )}
      {uploading.map((name) => (
        <div key={name} className="flex h-8 items-center gap-2 rounded-sm border border-n-100 px-2 text-xs">
          <span className="size-1.5 rounded-full bg-orange-500 skeleton-pulse" /> <span className="truncate">{name}</span>
          <span className="ml-auto font-mono text-[10px] text-n-500">wysyłam…</span>
        </div>
      ))}
      {canUpload && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn("flex h-11 w-full items-center justify-center gap-1 rounded-sm border border-dashed border-n-400 text-xs text-n-500 outline-none hover:border-n-500 hover:text-foreground", dragging && "border-orange-500 bg-orange-50 text-foreground")}
          >
            Upuść pliki tutaj albo <span className="font-medium text-link">wybierz z dysku</span>
          </button>
          <input ref={inputRef} type="file" multiple className="hidden" aria-label="Dodaj załącznik" onChange={(e) => { if (e.target.files?.length) { void handleFiles(e.target.files); e.target.value = ""; } }} />
        </>
      )}
      {error && <p className="text-xs text-danger-text">{error}</p>}
    </section>
  );
}

function useOpen(attachment: AttachmentItem) {
  const [pending, start] = useTransition();
  const open = () =>
    start(async () => {
      const res = await getAttachmentDownloadUrlAction({ id: attachment.id });
      if (!res.ok) { alert(res.error); return; }
      if (isSvg(attachment.mimeType)) {
        // Fetch as blob and hand the browser a same-origin object URL with `download` — the SVG never
        // becomes a navigable document, so embedded scripts cannot run.
        const blob = await (await fetch(res.url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = attachment.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  return { open, pending };
}

function Thumb({ attachment, canDelete }: { attachment: AttachmentItem; canDelete: boolean }) {
  const { open, pending } = useOpen(attachment);
  const svg = isSvg(attachment.mimeType);
  return (
    <figure className="group/thumb relative box-content h-20 w-[120px] shrink-0 overflow-hidden rounded-sm border border-border bg-n-50">
      <a
        href="#"
        download={svg ? attachment.filename : undefined}
        aria-label={svg ? `Pobierz ${attachment.filename}` : `Otwórz ${attachment.filename}`}
        title={attachment.filename}
        onClick={(e) => { e.preventDefault(); if (!pending) open(); }}
        className="block size-full outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.thumbnailUrl!} alt={attachment.filename} width={120} height={80} className="size-full object-cover" />
      </a>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-card/90 px-1.5 py-0.5 font-mono text-[9px] text-n-600">{attachment.filename}</figcaption>
      {canDelete && (
        <form action={deleteAttachmentAction} className="absolute right-1 top-1 m-0 opacity-0 focus-within:opacity-100 group-hover/thumb:opacity-100">
          <input type="hidden" name="id" value={attachment.id} />
          <button type="submit" aria-label={`Usuń ${attachment.filename}`} className="grid size-5 place-items-center rounded-sm border border-border bg-card text-n-600 outline-none hover:text-danger-text"><IconClose width={11} height={11} /></button>
        </form>
      )}
    </figure>
  );
}

function FileRow({ attachment, canDelete }: { attachment: AttachmentItem; canDelete: boolean }) {
  const { open, pending } = useOpen(attachment);
  const svg = isSvg(attachment.mimeType);
  return (
    <li className="flex h-8 items-center gap-2 rounded-sm border border-n-100 px-2">
      <IconFile className="shrink-0 text-n-500" width={14} height={14} />
      <a href="#" download={svg ? attachment.filename : undefined} onClick={(e) => { e.preventDefault(); if (!pending) open(); }} className="min-w-0 flex-1 truncate text-xs text-foreground no-underline hover:text-link hover:underline">{attachment.filename}</a>
      <span className="font-mono text-[10px] text-n-500">{formatBytes(attachment.sizeBytes)}</span>
      <Button variant="ghost" size="sm" iconOnly aria-label={`Pobierz ${attachment.filename}`} onClick={open} disabled={pending} className="size-6"><IconDownload /></Button>
      {canDelete && (
        <form action={deleteAttachmentAction} className="m-0">
          <input type="hidden" name="id" value={attachment.id} />
          <Button type="submit" variant="ghost" size="sm" iconOnly aria-label={`Usuń ${attachment.filename}`} className="size-6 hover:text-danger-text"><IconTrash /></Button>
        </form>
      )}
    </li>
  );
}
