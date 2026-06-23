"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  Folder,
  FolderOpen,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  SquarePen,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import {
  createNoteAction,
  createNoteFolderAction,
  deleteNoteAction,
  deleteNoteFolderAction,
  emptyTrashAction,
  permanentDeleteNoteAction,
  renameNoteFolderAction,
  restoreNoteAction,
  togglePinNoteAction,
  updateNoteAction,
} from "@/app/(app)/my/notes/actions";
import {
  RichTextEditor,
  type RichTextDoc,
} from "@/components/task/rich-text-editor";

export interface NoteFolderRow {
  id: string;
  name: string;
}
export interface NoteListRow {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
  pinned: boolean;
  folderId: string | null;
  // Marker for Trash view rows.
  isTrashed: boolean;
}
export interface ActiveNote {
  id: string;
  title: string;
  content: string;
  contentJson: RichTextDoc | null;
  folderId: string | null;
  pinned: boolean;
  isTrashed: boolean;
  updatedAt: string;
}

// Mobile screen state from URL params: no params = folders, folderId/q = list, noteId = editor.
export function NotesWorkspace({
  folders,
  notes,
  totalByFolder,
  selectedFolder,
  searchQuery,
  hasFolderParam,
  hasNoteParam,
  activeNote,
}: {
  folders: NoteFolderRow[];
  notes: NoteListRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
  searchQuery: string;
  hasFolderParam: boolean;
  hasNoteParam: boolean;
  activeNote: ActiveNote | null;
}) {
  // Search counts as "user entered list view" — stay in list even without folderId.
  const mobileView: "folders" | "list" | "editor" = hasNoteParam
    ? "editor"
    : hasFolderParam || searchQuery
      ? "list"
      : "folders";

  const editorBackHref = hasFolderParam
    ? `/my/notes?folderId=${selectedFolder}`
    : "/my/notes";

  return (
    // v4 glass card — całość owinięta w rounded-[22px] z brand-tinted shadow.
    // 3-kolumnowy układ (folders/list/editor) zachowany pod spodem, ale wizualnie
    // jako jedna karta z hairline'ami między kolumnami.
    <div className="relative h-[calc(100dvh-0px)] overflow-hidden rounded-[22px] border border-white/60 bg-white/55 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-full overflow-hidden">
        <FoldersColumn
          folders={folders}
          totalByFolder={totalByFolder}
          selectedFolder={selectedFolder}
          hideOnMobile={mobileView !== "folders"}
        />
        <NotesListColumn
          notes={notes}
          activeNoteId={activeNote?.id ?? null}
          selectedFolder={selectedFolder}
          searchQuery={searchQuery}
          hideOnMobile={mobileView !== "list"}
        />
        <EditorColumn
          note={activeNote}
          hideOnMobile={mobileView !== "editor"}
          backHref={editorBackHref}
        />
      </div>
    </div>
  );
}

function FoldersColumn({
  folders,
  totalByFolder,
  selectedFolder,
  hideOnMobile,
}: {
  folders: NoteFolderRow[];
  totalByFolder: Record<string, number>;
  selectedFolder: string;
  hideOnMobile: boolean;
}) {
  return (
    <aside
      className={`flex w-full flex-col gap-2 overflow-y-auto border-r border-white/50 bg-white/30 p-3 backdrop-blur-xl md:w-[280px] md:shrink-0 dark:border-white/[0.06] dark:bg-white/[0.02] ${
        hideOnMobile ? "max-md:hidden" : ""
      }`}
    >
      <div className="md:hidden flex items-center justify-between px-1 pb-3 pt-2">
        <span className="font-display text-[1.7rem] font-bold tracking-[-0.02em]">
          Foldery
        </span>
      </div>

      <div className="max-md:hidden px-2 pt-1 pb-2">
        <span className="eyebrow">Notatnik</span>
      </div>

      <FolderLink
        href="/my/notes?folderId=all"
        active={selectedFolder === "all"}
        label="Wszystkie"
        count={totalByFolder.all ?? 0}
        icon={<FolderOpen size={13} className="text-primary/70" />}
      />
      <FolderLink
        href="/my/notes?folderId=pinned"
        active={selectedFolder === "pinned"}
        label="Przypięte"
        count={totalByFolder.pinned ?? 0}
        icon={<Pin size={13} className="text-amber-500" />}
      />
      <FolderLink
        href="/my/notes?folderId=recent"
        active={selectedFolder === "recent"}
        label="Ostatnie 30 dni"
        count={totalByFolder.recent ?? 0}
        icon={<Clock size={13} className="text-sky-500" />}
      />

      <div className="my-1 border-t border-border" />

      {folders.map((f) => (
        <FolderRow
          key={f.id}
          folder={f}
          active={selectedFolder === f.id}
          count={totalByFolder[f.id] ?? 0}
        />
      ))}

      <div className="mt-auto flex flex-col gap-1.5">
        <FolderLink
          href="/my/notes?folderId=trash"
          active={selectedFolder === "trash"}
          label="Kosz"
          count={totalByFolder.trash ?? 0}
          icon={<Trash2 size={13} className="text-muted-foreground" />}
        />
        <NewFolderForm />
      </div>
    </aside>
  );
}

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
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className="flex items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-[0.95rem] transition-colors hover:bg-white/50 data-[active=true]:bg-primary/12 data-[active=true]:text-foreground dark:hover:bg-white/[0.04] md:py-2 md:text-[0.88rem]"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {/* v4 count pill — rounded-full bg-white/40 */}
      <span className="rounded-full bg-white/50 px-2 py-0.5 font-mono text-[0.66rem] text-muted-foreground dark:bg-white/[0.06] md:text-[0.6rem]">
        {count}
      </span>
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
        className="flex items-center gap-2 rounded-md px-2 py-1.5"
      >
        <Folder size={13} className="text-primary/70 shrink-0" />
        <input type="hidden" name="id" value={folder.id} />
        <input
          name="name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          required
          maxLength={80}
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
          className="flex-1 min-w-0 rounded-sm border border-primary/40 bg-background px-1.5 py-0.5 text-[0.85rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-1 rounded-md">
      <Link
        href={`/my/notes?folderId=${folder.id}`}
        data-active={active ? "true" : "false"}
        onDoubleClick={() => setRenaming(true)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-[0.95rem] text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground data-[active=true]:bg-primary/12 data-[active=true]:text-foreground dark:hover:bg-white/[0.04] md:py-2 md:text-[0.88rem]"
      >
        <Folder size={13} className="text-primary/70 shrink-0" />
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="rounded-full bg-white/50 px-2 py-0.5 font-mono text-[0.66rem] text-muted-foreground dark:bg-white/[0.06] md:text-[0.6rem]">
          {count}
        </span>
      </Link>
      <form
        action={(fd) => startTransition(() => deleteNoteFolderAction(fd))}
        className="m-0"
      >
        <input type="hidden" name="id" value={folder.id} />
        <button
          type="submit"
          aria-label="Usuń folder"
          title="Usuń folder"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </form>
    </div>
  );
}

function NewFolderForm() {
  // Klient: "Dodajmy do NOTATEK przycisk 'nowy folder', który wygląda
  // inaczej". Dwa stany: collapsed = brand-gradient CTA, expanded = input
  // do wpisania nazwy + Save/Cancel. Wyrazistsze od poprzedniej inline'owej
  // formy która zlewała się z resztą sidebar'a.
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus size={14} /> Nowy folder
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createNoteFolderAction(fd);
          setName("");
          setExpanded(false);
        })
      }
      className="mt-1 flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.04] p-2"
    >
      <input
        ref={inputRef}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setExpanded(false);
          }
        }}
        required
        maxLength={80}
        placeholder="nazwa folderu…"
        className="h-9 rounded-md border border-border bg-background px-2 text-[0.88rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary"
      />
      <div className="flex items-center gap-1">
        <button
          type="submit"
          disabled={!name.trim()}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-brand-gradient px-2 font-sans text-[0.78rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Dodaj
        </button>
        <button
          type="button"
          onClick={() => {
            setName("");
            setExpanded(false);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Anuluj"
        >
          <X size={13} />
        </button>
      </div>
    </form>
  );
}

function NotesListColumn({
  notes,
  activeNoteId,
  selectedFolder,
  searchQuery,
  hideOnMobile,
}: {
  notes: NoteListRow[];
  activeNoteId: string | null;
  selectedFolder: string;
  searchQuery: string;
  hideOnMobile: boolean;
}) {
  // Smart folders (trash/pinned/recent) don't pre-fill folderId — only concrete folders do.
  const folderId =
    selectedFolder === "all" ||
    selectedFolder === "pinned" ||
    selectedFolder === "recent" ||
    selectedFolder === "trash"
      ? ""
      : selectedFolder;
  const isTrash = selectedFolder === "trash";

  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);

  // Debounced search → URL param; always set folderId so mobile back-chevron preserves state.
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

  const folderLabel = folderLabelFor(selectedFolder);

  // Pinned on top + remainder time-grouped (iOS Notes parity); Trash doesn't group.
  const pinned = isTrash ? [] : notes.filter((n) => n.pinned);
  const rest = isTrash ? notes : notes.filter((n) => !n.pinned);
  const timeGroups = groupNotesByTime(rest);

  return (
    <aside
      className={`flex w-full flex-col overflow-hidden border-r border-white/50 bg-white/20 backdrop-blur-xl md:w-[320px] md:shrink-0 dark:border-white/[0.06] dark:bg-white/[0.01] ${
        hideOnMobile ? "max-md:hidden" : ""
      }`}
    >
      <div className="md:hidden flex items-center gap-1 border-b border-border px-2 py-2">
        <Link
          href="/my/notes"
          aria-label="Wróć do folderów"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 py-2 text-primary transition-colors hover:bg-accent"
        >
          <ChevronLeft size={22} />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
            Foldery
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 border-b border-white/50 px-4 py-3 dark:border-white/[0.06]">
        <div className="md:hidden">
          <span className="font-display text-[1.7rem] font-bold tracking-[-0.02em]">
            {folderLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="eyebrow">
            {isTrash
              ? notes.length === 1
                ? "1 w koszu"
                : `${notes.length} w koszu`
              : notes.length === 1
                ? "1 notatka"
                : `${notes.length} notatek`}
          </span>
          {!isTrash ? (
            <form
              action={(fd) => startTransition(() => createNoteAction(fd))}
              className="m-0 max-md:hidden"
            >
              <input type="hidden" name="folderId" value={folderId} />
              <button
                type="submit"
                aria-label="Nowa notatka"
                title="Nowa notatka"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus size={14} />
              </button>
            </form>
          ) : (
            notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Usunąć wszystkie z kosza? Nie da się tego cofnąć.")) return;
                  startTransition(() => emptyTrashAction());
                }}
                className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive"
              >
                Opróżnij
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 transition-colors focus-within:border-primary/60 md:py-1">
          <Search size={12} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj…"
            className="flex-1 bg-transparent text-[0.92rem] outline-none placeholder:text-muted-foreground/60 md:text-[0.82rem]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Wyczyść"
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {notes.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <StickyNote size={22} className="text-muted-foreground/60" />
            <p className="mt-3 font-display text-[0.95rem] font-semibold">
              Pusto tu.
            </p>
            <p className="mt-1 text-[0.84rem] text-muted-foreground">
              Dodaj pierwszą notatkę klikając +
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground md:text-[0.58rem]">
                  Przypięte
                </div>
                {pinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    active={n.id === activeNoteId}
                    selectedFolder={selectedFolder}
                  />
                ))}
              </>
            )}
            {timeGroups.map((g) => (
              <div key={g.key}>
                <div className="px-4 pt-3 pb-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground md:text-[0.58rem]">
                  {g.label}
                </div>
                {g.notes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    active={n.id === activeNoteId}
                    selectedFolder={selectedFolder}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {!isTrash && (
        <form
          action={(fd) => startTransition(() => createNoteAction(fd))}
          // F12-K96 perf/UX: bottom-24 (5rem nad CzesiekFab który stoi na
          // mobile bottom-6 = 1.5rem + h-14 = ~5rem zajętej przestrzeni).
          className="md:hidden fixed bottom-24 right-5 z-30 m-0"
        >
          <input type="hidden" name="folderId" value={folderId} />
          <button
            type="submit"
            aria-label="Nowa notatka"
            title="Nowa notatka"
            className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_40px_-12px_rgba(10,10,40,0.45)] transition-transform active:scale-95"
          >
            <SquarePen size={20} />
          </button>
        </form>
      )}
    </aside>
  );
}

function NoteCard({
  note,
  active,
  selectedFolder,
}: {
  note: NoteListRow;
  active: boolean;
  selectedFolder: string;
}) {
  // Carry source folderId so the editor's back-chevron knows where to return.
  const folderForBack =
    selectedFolder && selectedFolder !== "all"
      ? selectedFolder
      : note.folderId
        ? note.folderId
        : "all";
  return (
    <Link
      href={`/my/notes?folderId=${folderForBack}&noteId=${note.id}`}
      data-active={active ? "true" : "false"}
      className="block border-b border-border px-4 py-3 transition-colors hover:bg-accent/40 data-[active=true]:bg-primary/10 active:bg-accent/60"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-display text-[1rem] font-semibold leading-tight tracking-[-0.01em] md:text-[0.95rem]">
          {note.title || "Bez tytułu"}
        </span>
        {note.pinned && <Pin size={11} className="shrink-0 text-amber-500" />}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[0.82rem] text-muted-foreground md:text-[0.78rem]">
        <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] md:text-[0.58rem]">
          {formatShortDateTime(note.updatedAt)}
        </span>
        <span className="truncate">{note.snippet || "Brak dodatkowego tekstu"}</span>
      </div>
    </Link>
  );
}

function EditorColumn({
  note,
  hideOnMobile,
  backHref,
}: {
  note: ActiveNote | null;
  hideOnMobile: boolean;
  backHref: string;
}) {
  if (!note) {
    return (
      <section
        className={`flex flex-1 items-center justify-center ${
          hideOnMobile ? "max-md:hidden" : ""
        }`}
      >
        <div className="max-w-[320px] text-center text-muted-foreground">
          <StickyNote size={28} className="mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-display text-[1rem] font-semibold text-foreground">
            Wybierz notatkę z listy.
          </p>
          <p className="mt-1 text-[0.88rem]">
            Albo kliknij <strong>+</strong> aby utworzyć nową.
          </p>
        </div>
      </section>
    );
  }
  return (
    <NoteEditor
      key={note.id}
      note={note}
      hideOnMobile={hideOnMobile}
      backHref={backHref}
    />
  );
}

function NoteEditor({
  note,
  hideOnMobile,
  backHref,
}: {
  note: ActiveNote;
  hideOnMobile: boolean;
  backHref: string;
}) {
  const [title, setTitle] = useState(note.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(note.contentJson);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isTrashed = note.isTrashed;

  // Autosave with debounce — matches Apple Notes (edits persist as you
  // type, no explicit Save button). Trashed notes are read-only.
  useEffect(() => {
    if (isTrashed) return;
    const docStr = doc ? JSON.stringify(doc) : "";
    const initialDocStr = note.contentJson ? JSON.stringify(note.contentJson) : "";
    if (title === note.title && docStr === initialDocStr) return;
    const h = setTimeout(() => {
      const fd = new FormData();
      fd.set("id", note.id);
      fd.set("title", title);
      if (doc) fd.set("contentJson", JSON.stringify(doc));
      startTransition(async () => {
        await updateNoteAction(fd);
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      });
    }, 500);
    return () => clearTimeout(h);
  }, [title, doc, note.id, note.title, note.contentJson, isTrashed]);

  return (
    <section
      className={`flex flex-1 flex-col overflow-hidden ${
        hideOnMobile ? "max-md:hidden" : ""
      }`}
    >
      <div className="md:hidden flex items-center gap-1 border-b border-border px-2 py-2">
        <Link
          href={backHref}
          aria-label="Wróć do listy notatek"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 py-2 text-primary transition-colors hover:bg-accent"
        >
          <ChevronLeft size={22} />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
            Notatki
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {isTrashed ? (
            <>
              <form
                action={(fd) => startTransition(() => restoreNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Przywróć"
                  title="Przywróć z kosza"
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw size={16} />
                </button>
              </form>
              <form
                action={(fd) => startTransition(() => permanentDeleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń trwale"
                  title="Usuń na zawsze"
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <form
                action={(fd) => startTransition(() => togglePinNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <input
                  type="hidden"
                  name="next"
                  value={note.pinned ? "false" : "true"}
                />
                <button
                  type="submit"
                  aria-label={note.pinned ? "Odepnij" : "Przypnij"}
                  title={note.pinned ? "Odepnij" : "Przypnij"}
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-amber-500 data-[on=true]:text-amber-500"
                  data-on={note.pinned ? "true" : "false"}
                >
                  {note.pinned ? <Pin size={16} /> : <PinOff size={16} />}
                </button>
              </form>

              <form
                action={(fd) => startTransition(() => deleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń (do kosza)"
                  title="Przenieś do kosza"
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <header className="max-md:hidden flex items-center gap-3 border-b border-white/50 px-6 py-3 dark:border-white/[0.06]">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {formatLongDateTime(note.updatedAt)}
        </span>
        {savedAt && !isTrashed && (
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-primary">
            zapisano {savedAt}
          </span>
        )}
        {isTrashed && (
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-destructive">
            🗑 w koszu — przywróć żeby edytować
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isTrashed ? (
            <>
              <form
                action={(fd) => startTransition(() => restoreNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Przywróć"
                  title="Przywróć z kosza"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  <RotateCcw size={13} /> Przywróć
                </button>
              </form>
              <form
                action={(fd) => startTransition(() => permanentDeleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń trwale"
                  title="Usuń na zawsze"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </>
          ) : (
            <>
              <form
                action={(fd) => startTransition(() => togglePinNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <input
                  type="hidden"
                  name="next"
                  value={note.pinned ? "false" : "true"}
                />
                <button
                  type="submit"
                  aria-label={note.pinned ? "Odepnij" : "Przypnij"}
                  title={note.pinned ? "Odepnij" : "Przypnij"}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-amber-500 data-[on=true]:text-amber-500"
                  data-on={note.pinned ? "true" : "false"}
                >
                  {note.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
              </form>

              <form
                action={(fd) => startTransition(() => deleteNoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Usuń (do kosza)"
                  title="Przenieś do kosza"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 md:px-8 md:py-6">
        <div className="md:hidden mb-3 flex items-center gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            {formatLongDateTime(note.updatedAt)}
          </span>
          {savedAt && !isTrashed && (
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-primary">
              zapisano {savedAt}
            </span>
          )}
          {isTrashed && (
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-destructive">
              🗑 w koszu
            </span>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tytuł"
          maxLength={200}
          readOnly={isTrashed}
          className="w-full border-0 bg-transparent pb-2 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em] outline-none placeholder:text-muted-foreground/40 md:text-[2rem]"
        />
        <div className="flex-1">
          <RichTextEditor
            initial={doc}
            readOnly={isTrashed}
            placeholder="Zacznij pisać…"
            variant={isTrashed ? "display" : "field"}
            extras="brief"
            onChange={(d) => setDoc(d)}
          />
        </div>
      </div>
    </section>
  );
}

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function formatLongDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}

function groupNotesByTime(
  notes: NoteListRow[],
): Array<{ key: string; label: string; notes: NoteListRow[] }> {
  if (notes.length === 0) return [];
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

  const buckets = new Map<
    string,
    { label: string; order: number; notes: NoteListRow[] }
  >();
  for (const n of notes) {
    const t = new Date(n.updatedAt).getTime();
    let key: string;
    let label: string;
    let order: number;
    if (t >= todayStart) {
      key = "today";
      label = "Dzisiaj";
      order = 0;
    } else if (t >= yesterdayStart) {
      key = "yesterday";
      label = "Wczoraj";
      order = 1;
    } else if (t >= weekStart) {
      key = "week";
      label = "Poprzednie 7 dni";
      order = 2;
    } else if (t >= monthStart) {
      key = "month";
      label = "Poprzednie 30 dni";
      order = 3;
    } else {
      const d = new Date(n.updatedAt);
      key = `m-${d.getFullYear()}-${d.getMonth()}`;
      const monthName = d.toLocaleDateString("pl-PL", {
        month: "long",
        year: "numeric",
      });
      label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      // Newer months sort first within "older" bucket.
      order = 1000 - (d.getFullYear() * 12 + d.getMonth());
    }
    const existing = buckets.get(key);
    if (existing) existing.notes.push(n);
    else buckets.set(key, { label, order, notes: [n] });
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({ key, label: g.label, notes: g.notes }));
}

function folderLabelFor(selectedFolder: string): string {
  switch (selectedFolder) {
    case "all":
      return "Wszystkie";
    case "pinned":
      return "Przypięte";
    case "recent":
      return "Ostatnie 30 dni";
    case "trash":
      return "Kosz";
    default:
      return "Notatki";
  }
}
