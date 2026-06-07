"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, File as FileIcon, Trash2, Download } from "lucide-react";
import {
  confirmAttachmentUploadAction,
  deleteAttachmentAction,
  getAttachmentDownloadUrlAction,
  requestAttachmentUploadAction,
} from "@/app/(app)/w/[workspaceId]/t/attachment-actions";

export interface AttachmentItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploader: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  isUploader: boolean;
  thumbnailUrl: string | null;
}

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function maxBytesForClient(mime: string): number {
  return mime.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_BYTES;
}

function readableLimit(mime: string): string {
  const mb = Math.round(maxBytesForClient(mime) / (1024 * 1024));
  return `${mb} MB`;
}

export function AttachmentsSection({
  taskId,
  attachments,
  canUpload,
  canModerate,
}: {
  taskId: string;
  attachments: AttachmentItem[];
  canUpload: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      const limit = maxBytesForClient(file.type);
      if (file.size > limit) {
        setError(`Plik "${file.name}" przekracza ${readableLimit(file.type)}.`);
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="eyebrow">Załączniki</span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {attachments.length}
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {attachments.map((a) => (
            <li key={a.id}>
              <AttachmentCard
                attachment={a}
                canDelete={a.isUploader || canModerate}
              />
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length > 0) {
                void handleFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => inputRef.current?.click()}
            data-dragging={dragging ? "true" : "false"}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/60 focus-visible:border-primary data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
          >
            <UploadCloud size={18} className="text-muted-foreground" />
            <p className="text-[0.92rem] text-foreground">
              Upuść pliki albo{" "}
              <span className="text-primary underline underline-offset-2">wybierz z dysku</span>
            </p>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
              obrazy · video (mp4/webm/mov, max 50 MB) · pdf · word · excel · txt · max 25 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </>
      )}

      {uploading.length > 0 && (
        <ul className="flex flex-col gap-1">
          {uploading.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[0.82rem]"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="truncate">{name}</span>
              <span className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                wysyłam…
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function AttachmentCard({
  attachment,
  canDelete,
}: {
  attachment: AttachmentItem;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const res = await getAttachmentDownloadUrlAction({ id: attachment.id });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      // Opening in a new tab lets the browser decide: inline-render images,
      // download others. The URL expires in 15 min so leaked tabs rot fast.
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const kb = (attachment.sizeBytes / 1024).toFixed(0);
  const sizeLabel = attachment.sizeBytes >= 1024 * 1024
    ? `${(attachment.sizeBytes / 1024 / 1024).toFixed(1)} MB`
    : `${kb} KB`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      {attachment.thumbnailUrl ? (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className="relative block aspect-[16/9] overflow-hidden bg-muted"
          aria-label={`Otwórz ${attachment.filename}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.filename}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-muted">
          <FileIcon size={28} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.86rem] font-medium">{attachment.filename}</span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            {sizeLabel} · {attachment.uploader.name ?? attachment.uploader.email.split("@")[0]}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          aria-label="Pobierz"
          title="Pobierz"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
        >
          <Download size={13} />
        </button>
        {canDelete && (
          <form action={deleteAttachmentAction} className="m-0">
            <input type="hidden" name="id" value={attachment.id} />
            <button
              type="submit"
              aria-label="Usuń"
              title="Usuń"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={13} />
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
