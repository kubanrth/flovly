"use client";

// „Załączniki” cell: 📎 count (or —) → popover with the file list + upload.
// Reuses the 3-step signed-URL flow (request → PUT → confirm).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmAttachmentUploadAction,
  deleteAttachmentAction,
  getAttachmentDownloadUrlAction,
  requestAttachmentUploadAction,
} from "@/app/(app)/w/[workspaceId]/t/attachment-actions";
import { attachmentPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconAttachment, IconTrash, IconUpload } from "@/components/ui/icons";

const MAX_BYTES = 25 * 1024 * 1024;

export interface AttachmentCellItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export function AttachmentCell({ taskId, attachments, canEdit }: { taskId: string; attachments: AttachmentCellItem[]; canEdit: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        setError(`Plik „${file.name}” przekracza 25 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const mimeType = file.type || "application/octet-stream";
        const req = await requestAttachmentUploadAction({ taskId, filename: file.name, mimeType, sizeBytes: file.size });
        if (!req.ok) {
          setError(req.error);
          continue;
        }
        const put = await fetch(req.signedUrl, { method: "PUT", headers: { "Content-Type": mimeType, "x-upsert": "false" }, body: file });
        if (!put.ok) {
          setError(`Upload „${file.name}” nie powiódł się (${put.status}).`);
          continue;
        }
        const confirm = await confirmAttachmentUploadAction({ taskId, storageKey: req.storageKey, filename: file.name, mimeType, sizeBytes: file.size });
        if (!confirm.ok) setError(confirm.error);
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
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error);
  };
  const remove = async (id: string) => {
    if (!confirm("Usunąć załącznik?")) return;
    const fd = new FormData();
    fd.set("id", id);
    await deleteAttachmentAction(fd);
    router.refresh();
  };

  const count = attachments.length;
  return (
    <Popover>
      <PopoverTrigger
        className={cn("inline-flex h-7 max-w-full items-center gap-1 rounded-sm px-1.5 text-xs outline-none hover:bg-n-100 data-popup-open:bg-n-100", count > 0 ? "text-fg-2" : "text-n-400")}
        title={count > 0 ? `${count} ${attachmentPl(count)}` : canEdit ? "Dodaj załącznik" : "Brak załączników"}
      >
        {count > 0 ? (
          <>
            <IconAttachment width={12} height={12} />
            <span className="tabular-nums">{count}</span>
          </>
        ) : (
          "—"
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-2">
        <p className="eyebrow px-1 pb-1.5">Załączniki ({count})</p>
        {count > 0 && (
          <ul className="mb-1.5 flex flex-col">
            {attachments.map((a) => (
              <li key={a.id} className="group flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-n-100">
                <button type="button" onClick={() => download(a.id)} title={a.filename} className="min-w-0 flex-1 truncate text-left outline-none hover:text-link">
                  {a.filename}
                </button>
                <span className="shrink-0 font-mono text-[10px] text-fg-3">{formatSize(a.sizeBytes)}</span>
                {canEdit && (
                  <Button variant="ghost" size="sm" iconOnly aria-label="Usuń załącznik" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => remove(a.id)}>
                    <IconTrash />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <Button variant="secondary" size="sm" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()}>
            <IconUpload />
            Dodaj plik
          </Button>
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
        {uploading.length > 0 && <p className="mt-2 px-1 text-xs text-muted-foreground">Wysyłanie: {uploading.join(", ")}…</p>}
        {error && <p className="mt-2 px-1 text-xs text-danger-text">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
