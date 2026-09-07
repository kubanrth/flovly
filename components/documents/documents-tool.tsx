"use client";

// F13 „Dokumenty" — jak Hasła: nagłówek + licznik + akcja, szukajka, wiersze.
// Wiersz: plik · rozmiar · kto i kiedy wgrał · komu udostępniono · Pobierz /
// Dostęp / Usuń. Upload: przeciągnij albo wybierz, od razu z wyborem osób.

import { startTransition, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_ATTACHMENT_BYTES } from "@/lib/storage";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PersonPicker } from "@/components/ui/combobox";
import { InputGroup } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { IconDownload, IconFolder, IconPlus, IconSearch, IconTrash, IconUpload } from "@/components/ui/icons";
import {
  confirmDocumentUploadAction, deleteDocumentAction, getDocumentDownloadUrlAction, requestDocumentUploadAction, setDocumentAccessAction,
} from "@/app/(app)/w/[workspaceId]/documents/actions";

export interface DocMember { id: string; name: string | null; email: string; avatarUrl: string | null }
export interface DocItem {
  id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string;
  uploader: DocMember; accessUserIds: string[];
}

// `||`, nie `??`: seed potrafi zostawic name = "" i awatar zostawal bez inicjalu.
const nazwa = (m: DocMember) => m.name?.trim() || m.email.split("@")[0]!;
const rozmiar = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
const kiedy = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const ROW = "flex items-center gap-3 border-b border-n-100 px-8 py-2.5 max-md:flex-wrap max-md:px-4";

export function DocumentsTool({ workspaceId, currentUserId, canManage, members, documents }: {
  workspaceId: string; currentUserId: string; canManage: boolean; members: DocMember[]; documents: DocItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  // Osoby wybrane PRZED wgraniem — dostęp nadaje się razem z plikiem.
  const [newAccess, setNewAccess] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const people = members.map((m) => ({ id: m.id, name: nazwa(m), avatar: m.avatarUrl }));

  const q = query.trim().toLowerCase();
  const visible = documents.filter((d) => !q || d.filename.toLowerCase().includes(q) || nazwa(d.uploader).toLowerCase().includes(q));

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const mime = file.type || "application/octet-stream";
      if (file.size > MAX_ATTACHMENT_BYTES) { toast.add({ title: `Plik „${file.name}" przekracza ${Math.round(MAX_ATTACHMENT_BYTES / 1048576)} MB.`, type: "error" }); continue; }
      setUploading((u) => [...u, file.name]);
      try {
        const req = await requestDocumentUploadAction({ workspaceId, filename: file.name, mimeType: mime, sizeBytes: file.size });
        if (!req.ok) { toast.add({ title: "Nie wgrano pliku", description: req.error, type: "error" }); continue; }
        const put = await fetch(req.signedUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: file });
        if (!put.ok) { toast.add({ title: `Upload „${file.name}" nie powiódł się (${put.status}).`, type: "error" }); continue; }
        const ok = await confirmDocumentUploadAction({ workspaceId, storageKey: req.storageKey, filename: file.name, mimeType: mime, sizeBytes: file.size, accessUserIds: newAccess });
        if (!ok.ok) toast.add({ title: "Nie zapisano dokumentu", description: ok.error, type: "error" });
      } catch (e) {
        toast.add({ title: "Błąd uploadu", description: e instanceof Error ? e.message : undefined, type: "error" });
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    router.refresh();
  };

  return (
    <div data-ui="documents" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-[-0.3px]">Dokumenty</h1>
          <p className="font-mono text-2xs text-fg-3">{documents.length} {plPlural(documents.length, "plik", "pliki", "plików")}</p>
        </div>
        {canManage && (
          <>
            <input ref={fileRef} type="file" multiple className="hidden" aria-label="Dodaj dokument" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
            <Button className="shrink-0" onClick={() => fileRef.current?.click()} loading={uploading.length > 0}>
              <IconPlus width={14} height={14} />
              Dodaj dokument
            </Button>
          </>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <InputGroup size="sm" type="search" className="w-[220px] max-md:w-full" leading={<IconSearch />} placeholder="Szukaj pliku…" aria-label="Szukaj pliku" value={query} onChange={(e) => setQuery(e.target.value)} />
        {canManage && (
          <div className="flex items-center gap-1.5 text-xs text-fg-2">
            <span>Dostęp dla nowych plików:</span>
            <PersonPicker people={people} value={newAccess} onValueChange={setNewAccess} label="Dostęp dla nowych plików" className="h-7 gap-1 px-1.5 text-xs">
              {newAccess.length ? <AvatarStack people={people.filter((p) => newAccess.includes(p.id)).map((p) => ({ name: p.name, src: p.avatar }))} size={20} max={4} /> : <span className="text-fg-3">tylko ja i admini</span>}
            </PersonPicker>
          </div>
        )}
      </div>

      <div
        className={cn("min-h-0 flex-1 overflow-y-auto", dragging && "bg-orange-50")}
        onDragOver={(e) => { if (canManage) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { if (!canManage) return; e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
      >
        {uploading.map((n) => (
          <div key={n} className={cn(ROW, "text-sm text-fg-2")}><IconUpload width={14} height={14} className="animate-pulse" /> {`Wgrywam „${n}”…`}</div>
        ))}
        {visible.length === 0 && uploading.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <EmptyState
              icon={<IconFolder />}
              title={q ? "Brak dopasowań" : "Brak dokumentów"}
              description={q ? "Spróbuj innej frazy." : canManage ? "Dodaj plik i wskaż, kto ma go widzieć." : "Nic Ci jeszcze nie udostępniono."}
              action={canManage && !q ? <Button size="sm" onClick={() => fileRef.current?.click()}><IconPlus width={14} height={14} /> Dodaj dokument</Button> : undefined}
            />
          </div>
        ) : (
          visible.map((d) => <DocRow key={d.id} doc={d} members={members} people={people} canManage={canManage} currentUserId={currentUserId} />)
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, members, people, canManage, currentUserId }: {
  doc: DocItem; members: DocMember[]; people: { id: string; name: string; avatar: string | null }[]; canManage: boolean; currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [access, setAccess] = useState(doc.accessUserIds);
  const shared = members.filter((m) => access.includes(m.id));

  const download = () =>
    start(async () => {
      const res = await getDocumentDownloadUrlAction({ id: doc.id });
      if (!res.ok) { toast.add({ title: "Nie można pobrać", description: res.error, type: "error" }); return; }
      // Przez blob, nie bezposrednim linkiem: atrybut `download` nie dziala dla
      // innej domeny (storage), wiec plik zapisywalby sie pod losowym kluczem
      // zamiast pod swoja nazwa. Tak samo robia zalaczniki zadan.
      try {
        const blob = await (await fetch(res.url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = res.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      } catch (e) {
        toast.add({ title: "Nie można pobrać", description: e instanceof Error ? e.message : undefined, type: "error" });
      }
    });
  const changeAccess = (ids: string[]) => {
    const prev = access;
    setAccess(ids);
    startTransition(async () => {
      const res = await setDocumentAccessAction({ id: doc.id, userIds: ids });
      if (!res.ok) { setAccess(prev); toast.add({ title: "Nie zmieniono dostępu", description: res.error, type: "error" }); return; }
      router.refresh();
    });
  };
  const remove = () => {
    if (!confirm(`Usunąć „${doc.filename}"? Pliku nie da się przywrócić.`)) return;
    const fd = new FormData(); fd.set("id", doc.id);
    startTransition(() => deleteDocumentAction(fd));
  };

  return (
    <div data-ui="document-row" className={ROW}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-n-100 text-fg-2"><IconFolder width={16} height={16} /></span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={download} disabled={pending} className="block max-w-full truncate text-left text-sm font-medium text-foreground outline-none hover:text-orange-800 hover:underline">
          {doc.filename}
        </button>
        <div className="flex flex-wrap items-center gap-x-1.5 text-2xs text-fg-3">
          <span className="font-mono">{rozmiar(doc.sizeBytes)}</span>
          <span>·</span>
          <span>{nazwa(doc.uploader)}{doc.uploader.id === currentUserId ? " (ja)" : ""}</span>
          <span>·</span>
          <span className="font-mono">{kiedy(doc.createdAt)}</span>
        </div>
      </div>
      {/* Komu udostępniono. Zarządzający zmienia to w miejscu; reszta tylko widzi. */}
      {canManage ? (
        <PersonPicker people={people} value={access} onValueChange={changeAccess} label={`Dostęp do ${doc.filename}`} className="h-7 shrink-0 gap-1 px-1.5 text-xs">
          {shared.length ? <AvatarStack people={shared.map((m) => ({ name: nazwa(m), src: m.avatarUrl }))} size={20} max={4} /> : <span className="text-fg-3">Nadaj dostęp…</span>}
        </PersonPicker>
      ) : shared.length > 0 ? (
        <AvatarStack people={shared.map((m) => ({ name: nazwa(m), src: m.avatarUrl }))} size={20} max={4} />
      ) : null}
      <Button variant="secondary" size="sm" onClick={download} loading={pending} aria-label={`Pobierz ${doc.filename}`}>
        <IconDownload width={12} height={12} />
        Pobierz
      </Button>
      {canManage && (
        <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń ${doc.filename}`} onClick={remove} className="text-fg-3 hover:text-danger-text">
          <IconTrash />
        </Button>
      )}
      {/* Avatar wgrywającego dla czytelności na desktopie */}
      <Avatar name={nazwa(doc.uploader)} src={doc.uploader.avatarUrl} size={20} className="max-md:hidden" />
    </div>
  );
}
