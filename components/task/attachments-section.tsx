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

      {/* Filmstrip — 96x70 tiles in a horizontal scroll. Diagonal-striped
          placeholders give files a recognizable visual texture (spec). The
          inline dashed "Dodaj" tile is the upload affordance — replaces the
          old big dashed dropzone box. Drop-on-strip still works. */}
      {(attachments.length > 0 || canUpload) && (
        <div
          onDragOver={(e) => {
            if (!canUpload) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (!canUpload) return;
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length > 0) {
              void handleFiles(e.dataTransfer.files);
            }
          }}
          data-dragging={dragging ? "true" : "false"}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 transition-colors data-[dragging=true]:bg-primary/5"
        >
          {attachments.map((a) => (
            <AttachmentTile
              key={a.id}
              attachment={a}
              canDelete={a.isUploader || canModerate}
            />
          ))}
          {canUpload && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Dodaj załącznik"
              className="flex h-[70px] w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/70 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <UploadCloud size={16} />
              <span className="text-[0.7rem] font-medium">Dodaj</span>
            </button>
          )}
        </div>
      )}

      {canUpload && (
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
      )}

      {canUpload && (
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          obrazy · video (mp4/webm/mov, max 50 MB) · pdf · word · excel · txt · max 25 MB
        </p>
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

// Filmstrip tile: 96x70 thumbnail with diagonal-striped placeholder when
// no thumbnail is available. Filename anchored bottom-left in mono micro
// type. Hover surface reveals Download/Delete affordances.
function AttachmentTile({
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

  return (
    <article className="group/tile relative h-[70px] w-24 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        aria-label={`Otwórz ${attachment.filename}`}
        className="block h-full w-full"
      >
        {attachment.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.filename}
            className="h-full w-full object-cover transition-transform duration-200 group-hover/tile:scale-[1.04]"
          />
        ) : (
          // Diagonal stripes placeholder (per spec) — pure CSS so no asset.
          <div
            aria-hidden
            className="h-full w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted) 60%, transparent) 0 7px, color-mix(in oklch, var(--muted) 90%, transparent) 7px 14px)",
            }}
          />
        )}
      </button>

      {/* Filename overlay — anchored bottom-left, mono micro type. */}
      <span
        className="pointer-events-none absolute inset-x-1.5 bottom-1 truncate font-mono text-[0.62rem] text-foreground/80"
        title={attachment.filename}
      >
        {!attachment.thumbnailUrl && (
          <FileIcon size={9} className="-mt-0.5 mr-1 inline" />
        )}
        {attachment.filename}
      </span>

      {/* Hover actions — top-right cluster, kept compact so they don't
          overlap the filename track. */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          aria-label="Pobierz"
          title="Pobierz"
          className="grid h-5 w-5 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground disabled:opacity-60"
        >
          <Download size={11} />
        </button>
        {canDelete && (
          <form action={deleteAttachmentAction} className="m-0">
            <input type="hidden" name="id" value={attachment.id} />
            <button
              type="submit"
              aria-label="Usuń"
              title="Usuń"
              className="grid h-5 w-5 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive"
            >
              <Trash2 size={11} />
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
