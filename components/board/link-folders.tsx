"use client";

import { startTransition, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createLinkFolderAction,
  createLinkFolderColumnAction,
  createLinkFolderRowAction,
  deleteLinkFolderAction,
  deleteLinkFolderColumnAction,
  deleteLinkFolderRowAction,
  renameLinkFolderAction,
  renameLinkFolderColumnAction,
  setLinkFolderCellAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/link-folder-actions";

export interface LinkFolderData {
  id: string;
  name: string;
  columns: { id: string; name: string }[];
  rows: {
    id: string;
    cells: Record<string, string>;
  }[];
}

// "Dodaj folder linków" replaces the old chip-based BoardLinks.
// Klient wants a named folder that expands into a spreadsheet-like
// table with user-defined columns (Nazwa / Link / Opis / ...). Each
// folder is independent — user can keep "Brandbook materials" with
// different columns than "API references" on the same board.
export function LinkFolders({
  workspaceId,
  boardId,
  folders,
  canManage,
}: {
  workspaceId: string;
  boardId: string;
  folders: LinkFolderData[];
  canManage: boolean;
}) {
  if (folders.length === 0 && !canManage) return null;

  return (
    <div className="flex flex-col gap-2">
      {folders.map((f) => (
        <FolderBlock
          key={f.id}
          folder={f}
          workspaceId={workspaceId}
          canManage={canManage}
        />
      ))}

      {canManage && <NewFolderForm workspaceId={workspaceId} boardId={boardId} />}
    </div>
  );
}

function FolderBlock({
  folder,
  workspaceId,
  canManage,
}: {
  folder: LinkFolderData;
  workspaceId: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(folder.name);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* `group` enables the rename / delete icons (group-hover:opacity-100)
          on hover — without it those buttons were stuck at opacity-0 and the
          folder looked unrenamable. */}
      <div className="group flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={open ? "Zwiń folder" : "Rozwiń folder"}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <FolderOpen size={14} className="text-primary shrink-0" />

        {renaming && canManage ? (
          <form
            action={(fd) =>
              startTransition(async () => {
                await renameLinkFolderAction(fd);
                setRenaming(false);
              })
            }
            className="flex flex-1 items-center gap-1"
          >
            <input type="hidden" name="id" value={folder.id} />
            <input
              name="name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              required
              autoFocus
              maxLength={120}
              onBlur={(e) => {
                if (nameDraft.trim() === folder.name || nameDraft.trim() === "") {
                  setNameDraft(folder.name);
                  setRenaming(false);
                  return;
                }
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNameDraft(folder.name);
                  setRenaming(false);
                }
              }}
              className="flex-1 min-w-0 rounded-sm border border-primary/40 bg-background px-2 py-0.5 font-display text-[0.95rem] font-semibold outline-none focus:border-primary"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="group flex flex-1 min-w-0 items-center gap-1.5 text-left"
          >
            <span className="truncate font-display text-[0.95rem] font-semibold tracking-[-0.01em]">
              {folder.name}
            </span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              {folder.rows.length} {folder.rows.length === 1 ? "wiersz" : "wierszy"}
            </span>
          </button>
        )}

        {canManage && !renaming && (
          <>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Zmień nazwę"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Pencil size={11} />
            </button>
            <form
              action={(fd) => startTransition(() => deleteLinkFolderAction(fd))}
              className="m-0"
            >
              <input type="hidden" name="id" value={folder.id} />
              <button
                type="submit"
                aria-label="Usuń folder"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={11} />
              </button>
            </form>
          </>
        )}
      </div>

      {open && (
        <FolderTable folder={folder} workspaceId={workspaceId} canManage={canManage} />
      )}
    </div>
  );
}

function FolderTable({
  folder,
  workspaceId: _workspaceId,
  canManage,
}: {
  folder: LinkFolderData;
  workspaceId: string;
  canManage: boolean;
}) {
  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full text-[0.86rem]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {folder.columns.map((c) => (
              <ColumnHeader key={c.id} column={c} canManage={canManage} />
            ))}
            {canManage && (
              <th className="w-[180px] px-3 py-2">
                <NewColumnForm folderId={folder.id} />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {folder.rows.length === 0 ? (
            <tr>
              <td
                colSpan={folder.columns.length + (canManage ? 1 : 0)}
                className="py-6 text-center font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                brak wierszy — {canManage ? "kliknij +dodaj wiersz poniżej" : "poproś admina"}
              </td>
            </tr>
          ) : (
            folder.rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-border last:border-b-0 hover:bg-accent/30"
              >
                {folder.columns.map((c) => (
                  // max-w + min-w-0 zmuszają table-cell do shrinkowania, bez
                  // tego truncate w środku nie pali (cell rosła do długości
                  // URL'a i rozpychała całą tabelę). 260px to widoczna ścieżka
                  // typu github.com/user/repo bez rozdmuchiwania layoutu.
                  <td
                    key={c.id}
                    className="max-w-[260px] min-w-0 overflow-hidden px-3 py-1.5 align-middle"
                  >
                    <CellInput
                      rowId={row.id}
                      columnId={c.id}
                      initial={row.cells[c.id] ?? ""}
                      canManage={canManage}
                    />
                  </td>
                ))}
                {canManage && (
                  <td className="w-10 px-2 py-1.5 align-middle">
                    <form
                      action={(fd) =>
                        startTransition(() => deleteLinkFolderRowAction(fd))
                      }
                      className="m-0"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        aria-label="Usuń wiersz"
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))
          )}
          {canManage && (
            <tr>
              <td
                colSpan={folder.columns.length + 1}
                className="px-3 py-2 text-left"
              >
                <form
                  action={(fd) => startTransition(() => createLinkFolderRowAction(fd))}
                  className="m-0"
                >
                  <input type="hidden" name="folderId" value={folder.id} />
                  <button
                    type="submit"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    <Plus size={11} /> dodaj wiersz
                  </button>
                </form>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ColumnHeader({
  column,
  canManage,
}: {
  column: { id: string; name: string };
  canManage: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.name);

  return (
    <th className="px-3 py-2 text-left font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {renaming && canManage ? (
        <form
          action={(fd) =>
            startTransition(async () => {
              await renameLinkFolderColumnAction(fd);
              setRenaming(false);
            })
          }
        >
          <input type="hidden" name="id" value={column.id} />
          <input
            name="name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            required
            maxLength={80}
            onBlur={(e) => {
              if (draft.trim() === column.name || draft.trim() === "") {
                setDraft(column.name);
                setRenaming(false);
                return;
              }
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(column.name);
                setRenaming(false);
              }
            }}
            className="w-full rounded-sm border border-primary/40 bg-background px-1 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] outline-none focus:border-primary"
          />
        </form>
      ) : (
        <div className="group flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => canManage && setRenaming(true)}
            className="flex-1 text-left truncate"
          >
            {column.name}
          </button>
          {canManage && (
            <form
              action={(fd) => startTransition(() => deleteLinkFolderColumnAction(fd))}
              className="m-0"
            >
              <input type="hidden" name="id" value={column.id} />
              <button
                type="submit"
                aria-label="Usuń kolumnę"
                className="grid h-4 w-4 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X size={10} />
              </button>
            </form>
          )}
        </div>
      )}
    </th>
  );
}

function NewColumnForm({ folderId }: { folderId: string }) {
  const [name, setName] = useState("");
  // Submit on Enter or button click; explicit button
  // makes the affordance obvious. Previously users typed and didn't
  // realise they had to hit Enter.
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createLinkFolderColumnAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-0.5 transition-colors focus-within:border-primary/60"
    >
      <input type="hidden" name="folderId" value={folderId} />
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder="+ dodaj kolumnę"
        className="flex-1 min-w-0 bg-transparent font-mono text-[0.62rem] uppercase tracking-[0.14em] outline-none placeholder:text-muted-foreground/60"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj kolumnę"
        title="Dodaj kolumnę (Enter)"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={11} />
      </button>
    </form>
  );
}

function CellInput({
  rowId,
  columnId,
  initial,
  canManage,
}: {
  rowId: string;
  columnId: string;
  initial: string;
  canManage: boolean;
}) {
  // Read-only mode (non-admin): URLs zawsze klikalne.
  if (!canManage) {
    if (initial.length === 0) return <MutedDash />;
    return isUrl(initial) ? (
      <a
        href={initial}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {initial}
      </a>
    ) : (
      <span className="truncate">{initial}</span>
    );
  }
  return <AdminCell rowId={rowId} columnId={columnId} initial={initial} />;
}

// Admin cell w trybie dual-mode (view + edit).
// Klient zażądał żeby URL'e były same w sobie klikalne (bez osobnej
// ikony). Strategia jak w Notion/Airtable:
// - default = view mode: URL renderuje się jako klikalny <a>
// - dwuklik na komórkę albo hover-pencil → tryb edycji
// - pusta komórka = klik = tryb edycji
// - w edit mode: autoFocus input, blur zapisuje, Esc anuluje
function AdminCell({
  rowId,
  columnId,
  initial,
}: {
  rowId: string;
  columnId: string;
  initial: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={setLinkFolderCellAction}
        onSubmit={() => setEditing(false)}
        className="m-0 flex items-center"
      >
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="columnId" value={columnId} />
        <input
          name="value"
          type="text"
          defaultValue={initial}
          autoFocus
          onBlur={(e) => {
            if (e.currentTarget.value === initial) {
              setEditing(false);
              return;
            }
            (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          placeholder="—"
          className="w-full bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/40"
        />
      </form>
    );
  }

  // Empty cell — full-width clickable affordance to enter edit mode.
  if (initial.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full text-left font-mono text-[0.7rem] text-muted-foreground/40 transition-colors hover:text-foreground"
      >
        — kliknij aby dodać —
      </button>
    );
  }

  // View mode: URL → klikalny <a>, non-URL → tekst z onDoubleClick.
  // Pencil icon hovered po prawej zawsze pozwala wejść w edycję bez
  // dwukliku. Klik w sam <a> nawiguje, klik w pusty obszar (dzięki
  // onDoubleClick na wrapperze) wchodzi w edit.
  return (
    <div
      className="group flex items-center gap-1"
      onDoubleClick={() => setEditing(true)}
    >
      {isUrl(initial) ? (
        <a
          href={initial}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-w-0 flex-1 truncate text-primary underline underline-offset-2"
          title={initial}
        >
          {previewUrl(initial)}
        </a>
      ) : (
        <span className="block min-w-0 flex-1 truncate" title={initial}>
          {initial}
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edytuj"
        title="Edytuj (lub dwuklik)"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

function NewFolderForm({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createLinkFolderAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 transition-colors focus-within:border-primary/60"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="boardId" value={boardId} />
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={120}
        placeholder="dodaj folder linków…"
        className="flex-1 bg-transparent font-mono text-[0.7rem] uppercase tracking-[0.14em] outline-none placeholder:text-muted-foreground/60"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj folder linków"
        title="Dodaj folder linków (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={12} />
      </button>
    </form>
  );
}

function MutedDash() {
  return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
}

function isUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Skraca długi URL do czytelnego podglądu: usuwa "www.", obcina ścieżkę gdy
// głębsza niż 2 segmenty, ucina hash/query. Pełny URL i tak ląduje w href +
// title — preview to tylko visual hint.
function previewUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return host;
    if (segments.length <= 2) return `${host}/${segments.join("/")}`;
    return `${host}/${segments.slice(0, 2).join("/")}/…`;
  } catch {
    return raw;
  }
}
