import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotesWorkspace } from "@/components/my/notes/notes-workspace";
import { folderCounts, noteDay, notePreview } from "@/components/my/notes/note-doc";

// E3 „Notatnik" — trzy panele (foldery / lista 320 / edytor 680), full-bleed.
// Parametry URL:
//   folderId — id folderu albo klucz smart-folderu: "all" | "pinned" | "trash"
//   noteId   — zaznaczona notatka
//   q        — szukanie po tytule i treści
export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    folderId?: string;
    noteId?: string;
    q?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const params = await searchParams;

  // Pobieramy też skasowane — widok Kosza filtruje niżej.
  const [folders, allNotes] = await Promise.all([
    db.noteFolder.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.note.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const live = allNotes.filter((n) => n.deletedAt === null);
  const trashed = allNotes.filter((n) => n.deletedAt !== null);
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));

  const selectedFolder = params.folderId ?? "all";
  const query = (params.q ?? "").trim().toLowerCase();
  // Drill-down mobilny: który panel jest na wierzchu zależy od obecności parametrów.
  const hasFolderParam = params.folderId !== undefined;
  const hasNoteParam = params.noteId !== undefined;

  let filteredNotes;
  switch (selectedFolder) {
    case "pinned":
      filteredNotes = live.filter((n) => n.pinned);
      break;
    case "trash":
      filteredNotes = trashed;
      break;
    case "all":
      filteredNotes = live;
      break;
    default:
      filteredNotes = live.filter((n) => n.folderId === selectedFolder);
  }

  if (query) {
    filteredNotes = filteredNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query),
    );
  }

  const selectedNoteId = params.noteId ?? filteredNotes[0]?.id ?? null;
  const activeNote = selectedNoteId
    ? (allNotes.find((n) => n.id === selectedNoteId) ?? null)
    : null;

  return (
    <NotesWorkspace
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      notes={filteredNotes.map((n) => ({
        id: n.id,
        title: n.title,
        preview: notePreview(n.content),
        updatedAt: n.updatedAt.toISOString(),
        pinned: n.pinned,
        folderId: n.folderId,
        folderName: n.folderId ? (folderNameById.get(n.folderId) ?? null) : null,
        isTrashed: n.deletedAt !== null,
      }))}
      totalByFolder={{
        ...folderCounts(live),
        all: live.length,
        pinned: live.filter((n) => n.pinned).length,
        trash: trashed.length,
      }}
      selectedFolder={selectedFolder}
      searchQuery={query}
      // RSC: „dzisiaj" liczone raz na serwerze, żeby etykiety listy nie rozjechały się przy hydracji.
      // eslint-disable-next-line react-hooks/purity
      today={noteDay(Date.now())}
      hasFolderParam={hasFolderParam}
      hasNoteParam={hasNoteParam}
      activeNote={
        activeNote
          ? {
              id: activeNote.id,
              title: activeNote.title,
              contentJson:
                (activeNote.contentJson as { type: "doc"; content?: unknown[] } | null | undefined) ??
                null,
              folderId: activeNote.folderId,
              folderName: activeNote.folderId
                ? (folderNameById.get(activeNote.folderId) ?? null)
                : null,
              pinned: activeNote.pinned,
              isTrashed: activeNote.deletedAt !== null,
              updatedAt: activeNote.updatedAt.toISOString(),
            }
          : null
      }
    />
  );
}
