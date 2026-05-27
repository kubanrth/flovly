import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotesWorkspace } from "@/components/my/notes/notes-workspace";

// Apple-Notes-style 3-column layout (fullwidth, no AppShell).
// URL params:
//   folderId — concrete folder id, or smart-folder key: "all" | "pinned" | "recent" | "trash"
//   noteId   — selected note id
//   q        — search query (filters title/content)
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

  // Fetch including deleted; filter per-view below.
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

  // RSC: Date.now() is fine here. React Compiler purity heuristic flags it
  // because it can't distinguish RSC from client components.
  // eslint-disable-next-line react-hooks/purity
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const selectedFolder = params.folderId ?? "all";
  const query = (params.q ?? "").trim().toLowerCase();
  // Mobile drill-down (iOS-Notes parity): folders → notes → editor depending
  // on which URL params are present. Desktop ignores these.
  const hasFolderParam = params.folderId !== undefined;
  const hasNoteParam = params.noteId !== undefined;

  let filteredNotes;
  switch (selectedFolder) {
    case "pinned":
      filteredNotes = live.filter((n) => n.pinned);
      break;
    case "recent":
      filteredNotes = live.filter((n) => n.updatedAt.getTime() >= recentCutoff);
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
    ? allNotes.find((n) => n.id === selectedNoteId) ?? null
    : null;

  return (
    <main className="flex-1 min-h-0">
      <NotesWorkspace
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        notes={filteredNotes.map((n) => ({
          id: n.id,
          title: n.title,
          snippet: n.content.slice(0, 100),
          updatedAt: n.updatedAt.toISOString(),
          pinned: n.pinned,
          folderId: n.folderId,
          isTrashed: n.deletedAt !== null,
        }))}
        totalByFolder={{
          all: live.length,
          pinned: live.filter((n) => n.pinned).length,
          recent: live.filter((n) => n.updatedAt.getTime() >= recentCutoff).length,
          trash: trashed.length,
          ...countNotesByFolder(live),
        }}
        selectedFolder={selectedFolder}
        searchQuery={query}
        hasFolderParam={hasFolderParam}
        hasNoteParam={hasNoteParam}
        activeNote={
          activeNote
            ? {
                id: activeNote.id,
                title: activeNote.title,
                content: activeNote.content,
                contentJson: (activeNote.contentJson as
                  | { type: "doc"; content?: unknown[] }
                  | null
                  | undefined) ?? null,
                folderId: activeNote.folderId,
                pinned: activeNote.pinned,
                isTrashed: activeNote.deletedAt !== null,
                updatedAt: activeNote.updatedAt.toISOString(),
              }
            : null
        }
      />
    </main>
  );
}

function countNotesByFolder(notes: { folderId: string | null }[]): Record<string, number> {
  const m: Record<string, number> = { none: 0 };
  for (const n of notes) {
    if (n.folderId === null) m.none = (m.none ?? 0) + 1;
    else m[n.folderId] = (m[n.folderId] ?? 0) + 1;
  }
  return m;
}
