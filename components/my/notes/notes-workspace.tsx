"use client";

// E3 „Notatnik" — trzy panele: Foldery (z licznikami) · lista 320px · edytor 680px.
// Autozapis 500 ms, „Zapisano hh:mm" i stopka w pasku na dole ekranu.
// Czysta logika (podgląd, liczniki, etykiety dat) siedzi w ./note-doc.ts.

import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createNoteAction,
  createNoteFolderAction,
  deleteNoteAction,
  deleteNoteFolderAction,
  emptyTrashAction,
  moveNoteAction,
  permanentDeleteNoteAction,
  renameNoteFolderAction,
  restoreNoteAction,
  togglePinNoteAction,
  updateNoteAction,
} from "@/app/(app)/my/notes/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconChevronLeft,
  IconClose,
  IconFolder,
  IconMore,
  IconMove,
  IconNotes,
  IconPlus,
  IconSearch,
  IconShare,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUndo,
} from "@/components/ui/icons";
import { InputGroup } from "@/components/ui/input";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { countActions, countWords, noteDateLabel, noteFullDate, noteTime } from "./note-doc";

export interface NoteFolderRow {
  id: string;
  name: string;
}
export interface NoteListRow {
  id: string;
  title: string;
  /** Jednolinijkowy podgląd liczony na serwerze (`notePreview`). */
  preview: string;
  updatedAt: string;
  pinned: boolean;
  folderId: string | null;
  folderName: string | null;
  isTrashed: boolean;
}
export interface ActiveNote {
  id: string;
  title: string;
  contentJson: RichTextDoc | null;
  folderId: string | null;
  folderName: string | null;
  pinned: boolean;
  isTrashed: boolean;
  updatedAt: string;
}

const SMART_FOLDERS = new Set(["all", "pinned", "trash"]);

const actionPl = (n: number) => plPlural(n, "akcja", "akcje", "akcji");
const donePl = (n: number) => plPlural(n, "ukończona", "ukończone", "ukończonych");
const wordPl = (n: number) => plPlural(n, "słowo", "słowa", "słów");

export function NotesWorkspace({
  folders,
  notes,
  totalByFolder,
  selectedFolder,
  searchQuery,
  today,
  hasFolderParam,
  hasNoteParam,
  activeNote,
}: {
  folders: NoteFolderRow[];
  notes: NoteListRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
  searchQuery: string;
  /** Dzień serwera (YYYY-MM-DD, Europe/Warsaw) — etykiety „dziś"/„wczoraj" bez rozjazdu hydracji. */
  today: string;
  hasFolderParam: boolean;
  hasNoteParam: boolean;
  activeNote: ActiveNote | null;
}) {
  // Mobile to drill-down z URL-a: brak parametrów = foldery, folderId/q = lista, noteId = edytor.
  const mobileView: "folders" | "list" | "editor" = hasNoteParam
    ? "editor"
    : hasFolderParam || searchQuery
      ? "list"
      : "folders";

  return (
    <div data-ui="notes" className="flex min-h-0 flex-1">
      <FoldersPane
        folders={folders}
        totalByFolder={totalByFolder}
        selectedFolder={selectedFolder}
        hidden={mobileView !== "folders"}
      />
      <ListPane
        notes={notes}
        activeNoteId={activeNote?.id ?? null}
        folders={folders}
        selectedFolder={selectedFolder}
        searchQuery={searchQuery}
        today={today}
        hidden={mobileView !== "list"}
      />
      <EditorPane
        key={activeNote?.id ?? "empty"}
        note={activeNote}
        folders={folders}
        backHref={hasFolderParam ? `/my/notes?folderId=${selectedFolder}` : "/my/notes"}
        hidden={mobileView !== "editor"}
      />
    </div>
  );
}

/* ─────────────────────────── Foldery ─────────────────────────── */

function FoldersPane({
  folders,
  totalByFolder,
  selectedFolder,
  hidden,
}: {
  folders: NoteFolderRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
  hidden: boolean;
}) {
  return (
    <aside
      data-ui="notes-folders"
      className={cn(
        "flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-border bg-canvas p-2",
        "max-md:w-full max-md:border-r-0",
        hidden && "max-md:hidden",
      )}
    >
      <div className="eyebrow flex h-[26px] shrink-0 items-end px-2">Foldery</div>

      <FolderLink
        href="/my/notes?folderId=all"
        active={selectedFolder === "all"}
        label="Wszystkie"
        count={totalByFolder.all ?? 0}
      />
      <FolderLink
        href="/my/notes?folderId=pinned"
        active={selectedFolder === "pinned"}
        label="Przypięte"
        count={totalByFolder.pinned ?? 0}
        icon={<IconStar width={14} height={14} className="shrink-0 text-n-500" />}
      />

      <div className="my-1.5 h-px shrink-0 bg-border" />

      {folders.map((f) => (
        <FolderRow
          key={f.id}
          folder={f}
          active={selectedFolder === f.id}
          count={totalByFolder[f.id] ?? 0}
        />
      ))}

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <FolderLink
          href="/my/notes?folderId=trash"
          active={selectedFolder === "trash"}
          label="Kosz"
          count={totalByFolder.trash ?? 0}
          icon={<IconTrash width={14} height={14} className="shrink-0 text-n-500" />}
        />
        <NewFolderForm />
      </div>
    </aside>
  );
}

const FOLDER_ROW =
  "flex h-[30px] items-center gap-2 rounded-md px-2 text-sm text-n-700 outline-none " +
  "hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200 " +
  "data-active:bg-n-100 data-active:font-medium data-active:text-foreground";

function FolderLink({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <Link href={href} data-active={active || undefined} className={FOLDER_ROW}>
      {icon ?? <IconFolder width={14} height={14} className="shrink-0 text-n-500" />}
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] text-fg-3">{count}</span>
    </Link>
  );
}

function FolderRow({
  folder,
  active,
  count,
}: {
  folder: NoteFolderRow;
  active: boolean;
  count: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  if (renaming) {
    return (
      <form
        action={(fd) =>
          startTransition(async () => {
            await renameNoteFolderAction(fd);
            setRenaming(false);
          })
        }
        className="flex h-[30px] items-center gap-2 px-2"
      >
        <IconFolder width={14} height={14} className="shrink-0 text-n-500" />
        <input type="hidden" name="id" value={folder.id} />
        <input
          name="name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          required
          maxLength={80}
          aria-label="Nazwa folderu"
          onBlur={(e) => {
            if (draft.trim() === folder.name || draft.trim() === "") {
              setDraft(folder.name);
              setRenaming(false);
              return;
            }
            (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(folder.name);
              setRenaming(false);
            }
          }}
          className="h-6 min-w-0 flex-1 rounded-sm border border-orange-500 bg-card px-1.5 text-sm outline-none"
        />
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-0.5">
      <Link
        href={`/my/notes?folderId=${folder.id}`}
        data-active={active || undefined}
        onDoubleClick={() => setRenaming(true)}
        className={cn(FOLDER_ROW, "min-w-0 flex-1")}
      >
        <IconFolder width={14} height={14} className="shrink-0 text-n-500" />
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="font-mono text-[10px] text-fg-3">{count}</span>
      </Link>
      <Menu>
        <MenuTrigger
          aria-label={`Opcje folderu ${folder.name}`}
          className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 outline-none hover:bg-n-200 hover:text-foreground focus-visible:opacity-100 focus-visible:shadow-[var(--focus)] active:bg-n-300 group-hover:opacity-100 data-popup-open:opacity-100 max-md:opacity-100"
        >
          <IconMore width={14} height={14} />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onClick={() => setRenaming(true)}>Zmień nazwę</MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<IconTrash />}
            onClick={() => {
              if (!confirm(`Usunąć folder „${folder.name}"? Notatki zostaną bez folderu.`)) return;
              const fd = new FormData();
              fd.set("id", folder.id);
              startTransition(() => void deleteNoteFolderAction(fd));
            }}
          >
            Usuń folder
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function NewFolderForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start"
      >
        <IconPlus />
        Nowy folder
      </Button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createNoteFolderAction(fd);
          setName("");
          setOpen(false);
        })
      }
      className="flex items-center gap-1"
    >
      <input
        ref={inputRef}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        required
        maxLength={80}
        placeholder="Nazwa folderu…"
        aria-label="Nazwa nowego folderu"
        className="h-7 min-w-0 flex-1 rounded-sm border border-input-border bg-card px-2 text-sm outline-none placeholder:text-n-500 focus:border-orange-500"
      />
      <Button type="submit" size="sm" iconOnly disabled={!name.trim()} aria-label="Dodaj folder">
        <IconPlus />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Anuluj"
        onClick={() => {
          setName("");
          setOpen(false);
        }}
      >
        <IconClose />
      </Button>
    </form>
  );
}

/* ─────────────────────────── Lista ─────────────────────────── */

function ListPane({
  notes,
  activeNoteId,
  folders,
  selectedFolder,
  searchQuery,
  today,
  hidden,
}: {
  notes: NoteListRow[];
  activeNoteId: string | null;
  folders: NoteFolderRow[];
  selectedFolder: string;
  searchQuery: string;
  today: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);
  const isTrash = selectedFolder === "trash";
  const folderId = SMART_FOLDERS.has(selectedFolder) ? "" : selectedFolder;

  // Szukanie leci do URL-a (debounce 300 ms) — filtrowanie robi serwer.
  useEffect(() => {
    if (search === searchQuery) return;
    const h = setTimeout(() => {
      const params = new URLSearchParams();
      params.set("folderId", selectedFolder || "all");
      if (search.trim()) params.set("q", search.trim());
      router.replace(`/my/notes?${params}`);
    }, 300);
    return () => clearTimeout(h);
  }, [search, searchQuery, selectedFolder, router]);

  const title =
    folders.find((f) => f.id === selectedFolder)?.name ??
    (selectedFolder === "pinned" ? "Przypięte" : isTrash ? "Kosz" : "Wszystkie");

  return (
    <div
      data-ui="notes-list"
      className={cn(
        "flex w-[320px] shrink-0 flex-col border-r border-border",
        "max-md:w-full max-md:border-r-0",
        hidden && "max-md:hidden",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <Link
          href="/my/notes"
          aria-label="Wróć do folderów"
          className="-ml-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200 md:hidden"
        >
          <IconChevronLeft />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-md font-semibold">{title}</h1>
        {isTrash ? (
          notes.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm("Opróżnić kosz? Tego nie da się cofnąć.")) return;
                startTransition(() => void emptyTrashAction());
              }}
            >
              Opróżnij
            </Button>
          )
        ) : (
          <form action={(fd) => startTransition(() => createNoteAction(fd))} className="m-0">
            <input type="hidden" name="folderId" value={folderId} />
            <Button type="submit" size="sm" iconOnly aria-label="Nowa notatka" title="Nowa notatka">
              <IconPlus />
            </Button>
          </form>
        )}
      </div>

      <div className="shrink-0 px-3.5 pb-2.5">
        <InputGroup
          size="sm"
          leading={<IconSearch />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj w notatkach…"
          aria-label="Szukaj w notatkach"
          className="text-xs"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {notes.length === 0 ? (
          <EmptyState
            className="mt-2"
            icon={<IconNotes />}
            title={search ? "Nic nie pasuje" : isTrash ? "Kosz jest pusty" : "Brak notatek"}
            description={search ? "Zmień frazę wyszukiwania." : isTrash ? undefined : "Nową dodasz przyciskiem +."}
          />
        ) : (
          notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              active={n.id === activeNoteId}
              selectedFolder={selectedFolder}
              today={today}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  active,
  selectedFolder,
  today,
}: {
  note: NoteListRow;
  active: boolean;
  selectedFolder: string;
  today: string;
}) {
  const backFolder = SMART_FOLDERS.has(selectedFolder)
    ? selectedFolder
    : (note.folderId ?? "all");
  return (
    <Link
      href={`/my/notes?folderId=${backFolder}&noteId=${note.id}`}
      data-active={active || undefined}
      data-ui="note-row"
      className={cn(
        "mb-0.5 block rounded-md px-2.5 py-2.5 outline-none",
        "hover:bg-row-hover focus-visible:shadow-[var(--focus)] active:bg-n-200",
        "data-active:bg-selected data-active:shadow-[inset_2px_0_0_var(--orange-500)]",
      )}
    >
      <div className="truncate text-sm leading-[18px] font-semibold">
        {note.title || "Bez tytułu"}
      </div>
      <div className="truncate text-xs leading-[17px] text-fg-2">
        {note.preview || "Pusta notatka"}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] text-fg-3">
          {noteDateLabel(note.updatedAt, today)}
        </span>
        <Chip size="sm" hue={note.isTrashed ? "red" : "gray"} className="max-w-[120px] truncate">
          {note.isTrashed ? "kosz" : (note.folderName ?? "bez folderu")}
        </Chip>
        {note.pinned && (
          <IconStarFilled width={11} height={11} role="img" aria-label="Przypięta" className="shrink-0 text-orange-500" />
        )}
      </div>
    </Link>
  );
}

/* ─────────────────────────── Edytor ─────────────────────────── */

function EditorPane({
  note,
  folders,
  backHref,
  hidden,
}: {
  note: ActiveNote | null;
  folders: NoteFolderRow[];
  backHref: string;
  hidden: boolean;
}) {
  if (!note) {
    return (
      <section
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center px-10",
          hidden && "max-md:hidden",
        )}
      >
        <EmptyState
          className="max-w-[320px]"
          icon={<IconNotes />}
          title="Wybierz notatkę z listy"
          description="Albo dodaj nową przyciskiem + nad listą."
        />
      </section>
    );
  }
  return <NoteEditor note={note} folders={folders} backHref={backHref} hidden={hidden} />;
}

function NoteEditor({
  note,
  folders,
  backHref,
  hidden,
}: {
  note: ActiveNote;
  folders: NoteFolderRow[];
  backHref: string;
  hidden: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(note.contentJson);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isTrashed = note.isTrashed;

  // Autozapis (500 ms) — jak w B11 „Opis". Notatka w koszu jest tylko do odczytu.
  useEffect(() => {
    if (isTrashed) return;
    const docStr = doc ? JSON.stringify(doc) : "";
    const initialStr = note.contentJson ? JSON.stringify(note.contentJson) : "";
    if (title === note.title && docStr === initialStr) return;
    const h = setTimeout(() => {
      const fd = new FormData();
      fd.set("id", note.id);
      fd.set("title", title);
      fd.set("contentJson", docStr || JSON.stringify({ type: "doc", content: [] }));
      startTransition(async () => {
        await updateNoteAction(fd);
        setSavedAt(noteTime(Date.now()));
      });
    }, 500);
    return () => clearTimeout(h);
  }, [title, doc, note.id, note.title, note.contentJson, isTrashed]);

  const actions = countActions(doc);
  const words = countWords(doc);

  return (
    <section
      data-ui="note-editor"
      className={cn("flex min-w-0 flex-1 flex-col", hidden && "max-md:hidden")}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3 max-md:px-3">
        <Link
          href={backHref}
          aria-label="Wróć do listy notatek"
          className="-ml-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200 md:hidden"
        >
          <IconChevronLeft />
        </Link>
        <span className="min-w-0 truncate text-xs text-fg-2">
          {note.folderName ?? "Wszystkie"} /
        </span>
        <span className="flex-1" />
        {isTrashed ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-danger-text max-md:hidden">
            <span aria-hidden className="size-[7px] rounded-full bg-danger" />W koszu
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-fg-3 max-md:hidden">
            <span aria-hidden className="size-[7px] rounded-full bg-success" />
            Zapisano {savedAt ?? noteTime(note.updatedAt)}
          </span>
        )}
        <ShareButton noteId={note.id} folderId={note.folderId} />
        <NoteMenu note={note} folders={folders} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-10 pt-7 pb-15 max-md:px-4 max-md:pt-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bez tytułu"
            maxLength={200}
            readOnly={isTrashed}
            aria-label="Tytuł notatki"
            className="w-full border-0 bg-transparent text-xl font-semibold tracking-[-0.3px] outline-none placeholder:text-n-400"
          />
          <div className="mt-1 mb-5 font-mono text-2xs text-fg-3">
            {noteFullDate(note.updatedAt)}
          </div>
          <div className="[&_.tiptap-content]:min-h-[280px]">
            <RichTextEditor
              initial={note.contentJson}
              readOnly={isTrashed}
              placeholder="Zacznij pisać…"
              variant="display"
              extras="brief"
              onChange={setDoc}
            />
          </div>
        </div>
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-muted-foreground max-md:px-3">
        notatka prywatna · folder {note.folderName ?? "brak"} ·{" "}
        {actions.total > 0
          ? `${actions.total} ${actionPl(actions.total)} (${actions.done} ${donePl(actions.done)})`
          : `${words} ${wordPl(words)}`}
      </footer>
    </section>
  );
}

function ShareButton({ noteId, folderId }: { noteId: string; folderId: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      title="Kopiuje link do notatki. Notatki są prywatne — otworzy je tylko Twoje konto."
      onClick={() => {
        const url = `${window.location.origin}/my/notes?folderId=${folderId ?? "all"}&noteId=${noteId}`;
        void navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <IconShare />
      {copied ? "Skopiowano" : "Udostępnij"}
    </Button>
  );
}

function NoteMenu({ note, folders }: { note: ActiveNote; folders: NoteFolderRow[] }) {
  const send = (action: (fd: FormData) => Promise<void>, fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => void action(fd));
  };

  return (
    <Menu>
      <MenuTrigger
        aria-label="Opcje notatki"
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200 data-popup-open:bg-n-100"
      >
        <IconMore width={15} height={15} />
      </MenuTrigger>
      <MenuContent align="end">
        {note.isTrashed ? (
          <>
            <MenuItem
              icon={<IconUndo />}
              onClick={() => send(restoreNoteAction, { id: note.id })}
            >
              Przywróć z kosza
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              destructive
              icon={<IconTrash />}
              onClick={() => {
                if (!confirm("Usunąć notatkę na zawsze?")) return;
                send(permanentDeleteNoteAction, { id: note.id });
              }}
            >
              Usuń trwale
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem
              icon={note.pinned ? <IconStarFilled /> : <IconStar />}
              onClick={() => send(togglePinNoteAction, { id: note.id, next: note.pinned ? "false" : "true" })}
            >
              {note.pinned ? "Odepnij" : "Przypnij"}
            </MenuItem>
            <MenuSub>
              <MenuSubTrigger icon={<IconMove />}>Przenieś do folderu</MenuSubTrigger>
              <MenuSubContent className="min-w-[200px]">
                <MenuItem
                  disabled={note.folderId === null}
                  onClick={() => send(moveNoteAction, { id: note.id, folderId: "" })}
                >
                  Bez folderu
                </MenuItem>
                {folders.map((f) => (
                  <MenuItem
                    key={f.id}
                    disabled={note.folderId === f.id}
                    onClick={() => send(moveNoteAction, { id: note.id, folderId: f.id })}
                  >
                    {f.name}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem
              destructive
              icon={<IconTrash />}
              onClick={() => send(deleteNoteAction, { id: note.id })}
            >
              Przenieś do kosza
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
