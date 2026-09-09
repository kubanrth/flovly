"use client";

// F13 „Umowy" — pliki dołączone do umowy (skan, PDF, aneks). Upload w dwóch
// krokach jak w Dokumentach: podpisany URL → PUT z przeglądarki → potwierdzenie.
// Pobranie idzie przez blob, bo atrybut `download` nie działa dla innej domeny
// (storage) i plik zapisywałby się pod losowym kluczem zamiast pod swoją nazwą.

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ATTACHMENT_BYTES } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { IconDownload, IconFile, IconTrash, IconUpload } from "@/components/ui/icons";
import {
  confirmContractFileUploadAction,
  deleteContractFileAction,
  getContractFileDownloadUrlAction,
  requestContractFileUploadAction,
} from "@/app/(app)/w/[workspaceId]/contracts/actions";

export interface ContractFileItem { id: string; filename: string; sizeBytes: number }

const rozmiar = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

export function ContractFiles({ contractId, contractTitle, files, canManage }: {
  contractId: string; contractTitle: string; files: ContractFileItem[]; canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const mime = file.type || "application/octet-stream";
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.add({ title: `Plik „${file.name}” przekracza ${Math.round(MAX_ATTACHMENT_BYTES / 1048576)} MB.`, type: "error" });
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const req = await requestContractFileUploadAction({ contractId, filename: file.name, mimeType: mime, sizeBytes: file.size });
        if (!req.ok) { toast.add({ title: "Nie dołączono pliku", description: req.error, type: "error" }); continue; }
        const put = await fetch(req.signedUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: file });
        if (!put.ok) { toast.add({ title: `Upload „${file.name}” nie powiódł się (${put.status}).`, type: "error" }); continue; }
        const ok = await confirmContractFileUploadAction({ contractId, storageKey: req.storageKey, filename: file.name, mimeType: mime, sizeBytes: file.size });
        if (!ok.ok) toast.add({ title: "Nie zapisano pliku", description: ok.error, type: "error" });
      } catch (e) {
        toast.add({ title: "Błąd uploadu", description: e instanceof Error ? e.message : undefined, type: "error" });
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    router.refresh();
  };

  const download = async (f: ContractFileItem) => {
    setBusy(f.id);
    try {
      const res = await getContractFileDownloadUrlAction({ id: f.id });
      if (!res.ok) { toast.add({ title: "Nie można pobrać", description: res.error, type: "error" }); return; }
      const blob = await (await fetch(res.url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.add({ title: "Nie można pobrać", description: e instanceof Error ? e.message : undefined, type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const remove = (f: ContractFileItem) => {
    if (!confirm(`Usunąć plik „${f.filename}” z umowy „${contractTitle}”?`)) return;
    const fd = new FormData();
    fd.set("id", f.id);
    startTransition(() => deleteContractFileAction(fd));
  };

  return (
    <div data-ui="contract-files">
      <div className="eyebrow mb-1.5">Pliki {files.length > 0 && <span className="font-mono font-normal">· {files.length}</span>}</div>
      {files.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id} className="group flex min-h-8 items-center gap-2 rounded-md border border-border bg-canvas px-2">
              <IconFile width={13} height={13} className="shrink-0 text-fg-3" />
              <button
                type="button"
                onClick={() => void download(f)}
                disabled={busy === f.id}
                title={`Pobierz ${f.filename}`}
                className="min-w-0 flex-1 truncate text-left text-xs text-foreground outline-none hover:underline disabled:opacity-60"
              >
                {f.filename}
              </button>
              <span className="shrink-0 font-mono text-2xs text-fg-3">{rozmiar(f.sizeBytes)}</span>
              <Button variant="ghost" size="sm" iconOnly aria-label={`Pobierz ${f.filename}`} loading={busy === f.id} onClick={() => void download(f)} className="size-6 shrink-0"><IconDownload /></Button>
              {canManage && (
                <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń plik ${f.filename}`} onClick={() => remove(f)} className="size-6 shrink-0 text-fg-3 hover:text-danger-text"><IconTrash /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            aria-label={`Dołącz plik do umowy ${contractTitle}`}
            onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
            className={cn(
              "flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 text-xs text-fg-2 outline-none hover:border-orange-500 hover:text-foreground",
              dragging && "border-orange-500 bg-orange-50 text-foreground",
            )}
          >
            <IconUpload width={13} height={13} />
            {uploading.length > 0 ? `Wgrywam ${uploading.length}…` : "Dołącz plik albo przeciągnij tutaj"}
          </button>
        </>
      ) : (
        files.length === 0 && <p className="text-xs text-fg-3">Brak plików.</p>
      )}
    </div>
  );
}
