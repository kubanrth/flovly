"use client";

import { startTransition, useMemo, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Folder,
  List as ListIcon,
  Plus,
  Star,
  Sun,
  Trash2,
  UserCheck as UserIcon,
} from "lucide-react";
import {
  bulkDeleteCompletedTodoItemsAction,
  createTodoFolderAction,
  createTodoItemAction,
  createTodoListAction,
  deleteTodoFolderAction,
  deleteTodoItemAction,
  deleteTodoListAction,
  toggleTodoImportantAction,
  toggleTodoItemAction,
  toggleTodoMyDayAction,
} from "@/app/(app)/my/todo/actions";
import type { SmartView } from "@/app/(app)/my/todo/page";
import { TodoDetailPanel, type TodoItemFull } from "@/components/my/todo/todo-detail-panel";

export interface TodoFolderNode {
  id: string;
  name: string;
  parentId: string | null;
}
export interface TodoListNode {
  id: string;
  name: string;
  folderId: string | null;
}

// F12-K17: assigned workspace task pokazywany w prawym panelu obok
// add-task. Klient chce widzieć jakie projektowe taski ma na karku
// kiedy planuje sobie listę.
export interface AssignedTaskRef {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  boardId: string;
  boardName: string;
  statusName: string | null;
  statusColor: string | null;
  stopAt: string | null;
}

// MS-To-Do-like labels / icons for smart views.
// F12-K22: dorzucone 'Przydzielone do mnie' (assigned-to-me) — pokazuje
// taski projektowe gdzie current user jest assignee, jako osobny widok
// w sidebarze (jak MS To Do). Zastępuje wcześniejszy embedded
// AssignedTasksPanel w prawym panelu.
const SMART_VIEWS: { key: SmartView; label: string; icon: typeof Sun; accent: string }[] = [
  { key: "my-day", label: "Mój dzień", icon: Sun, accent: "text-amber-500" },
  { key: "important", label: "Ważne", icon: Star, accent: "text-rose-500" },
  { key: "planned", label: "Zaplanowane", icon: CalendarDays, accent: "text-sky-500" },
  { key: "assigned", label: "Przydzielone do mnie", icon: UserIcon, accent: "text-emerald-500" },
];

// F9-11: fullwidth 2-column layout (sidebar + main) with a slide-in
// right-side detail panel when a task is selected. Folders only contain
// lists — nested folders are no longer part of the UX (we ignore
// parentId in the tree and server-side createTodoFolderAction forces
// parentId = null on new rows).
export function TodoWorkspace({
  folders,
  lists,
  activeListId,
  activeListName,
  smart,
  items,
  focusedItemId,
  hasViewParam,
  assignedTasks,
}: {
  folders: TodoFolderNode[];
  lists: TodoListNode[];
  activeListId: string | null;
  activeListName: string | null;
  smart: SmartView | null;
  items: TodoItemFull[];
  focusedItemId: string | null;
  // F12-K46: czy URL zawiera ?smart= albo ?listId= (decyduje o mobile view).
  hasViewParam: boolean;
  // F12-K17: workspace tasks gdzie current user jest przypisany.
  // Empty gdy lista nie aktywna albo user nie ma żadnych assigned.
  assignedTasks: AssignedTaskRef[];
}) {
  // Only render top-level folders — ignore any legacy nested rows.
  const rootFolders = useMemo(
    () => folders.filter((f) => f.parentId === null),
    [folders],
  );
  const listsByFolder = useMemo(() => {
    const m = new Map<string | null, TodoListNode[]>();
    for (const l of lists) {
      const k = l.folderId;
      const bucket = m.get(k) ?? [];
      bucket.push(l);
      m.set(k, bucket);
    }
    return m;
  }, [lists]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(focusedItemId);

  // F12-K18: optimistic UI dla add-task. Wcześniej user typował, naciskał
  // Enter, czekał na revalidatePath round-trip — feel laggy. Teraz item
  // pojawia się natychmiast w liście, server save w tle.
  // Mergeujemy items (server) + pending (client-only) — gdy server
  // zwróci, revalidatePath replace'uje optimistic na real.
  const [optimisticItems, addOptimisticItem] = useOptimistic<
    TodoItemFull[],
    { tempId: string; content: string; listId: string; listName: string }
  >(items, (state, pending) => [
    ...state,
    {
      id: pending.tempId,
      content: pending.content,
      completed: false,
      important: false,
      myDayAt: null,
      dueDate: null,
      reminderAt: null,
      notes: null,
      listId: pending.listId,
      listName: pending.listName,
      steps: [],
    },
  ]);

  const selectedItem = optimisticItems.find((i) => i.id === selectedItemId) ?? null;

  if (selectedItemId && !optimisticItems.find((i) => i.id === selectedItemId)) {
    setTimeout(() => setSelectedItemId(null), 0);
  }

  const activeSmart = SMART_VIEWS.find((v) => v.key === smart);
  const pageTitle = activeListName ?? activeSmart?.label ?? "TO DO";

  const incomplete = optimisticItems.filter((i) => !i.completed);
  const completed = optimisticItems.filter((i) => i.completed);

  // F12-K46: mobile screen state. Detail otwiera się state'em (selectedItem
  // !== null), więc nadpisuje URL-based ekrany.
  const mobileView: "sidebar" | "items" | "detail" = selectedItem
    ? "detail"
    : hasViewParam
      ? "items"
      : "sidebar";

  return (
    <div className="flex h-[calc(100dvh-0px)] overflow-hidden">
      {/* Left sidebar — smart views + flat folders with lists */}
      <aside
        className={`flex w-full flex-col gap-3 overflow-y-auto border-r border-border bg-card/50 p-3 md:w-[280px] md:shrink-0 ${
          mobileView !== "sidebar" ? "max-md:hidden" : ""
        }`}
      >
        <div className="md:hidden flex items-center justify-between px-1 pb-3 pt-2">
          <span className="font-display text-[1.7rem] font-bold tracking-[-0.02em]">
            TO DO
          </span>
        </div>
        <div className="max-md:hidden px-2 pt-1 pb-2">
          <span className="eyebrow">Prywatne TO DO</span>
        </div>

        {/* Smart views */}
        <div className="flex flex-col gap-0.5">
          {SMART_VIEWS.map((v) => {
            const Icon = v.icon;
            const active = smart === v.key && !activeListId;
            return (
              <Link
                key={v.key}
                href={`/my/todo?smart=${v.key}`}
                data-active={active ? "true" : "false"}
                className="flex items-center gap-2 rounded-md px-2 py-2.5 text-[0.95rem] transition-colors hover:bg-accent/60 data-[active=true]:bg-primary/10 data-[active=true]:text-foreground md:py-1.5 md:text-[0.88rem]"
              >
                <Icon size={14} className={v.accent} />
                <span className="flex-1">{v.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-1 border-t border-border" />

        {/* Root-level lists (no folder) */}
        {(listsByFolder.get(null) ?? []).map((l) => (
          <ListLink key={l.id} list={l} activeListId={activeListId} />
        ))}

        {/* Flat folders — each folder expands to show its lists */}
        {rootFolders.map((f) => (
          <FolderBlock
            key={f.id}
            folder={f}
            lists={listsByFolder.get(f.id) ?? []}
            activeListId={activeListId}
          />
        ))}

        {/* New folder / new list inputs pinned at bottom of sidebar */}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <NewListForm folderId={null} placeholder="+ nowa lista" />
          <NewFolderForm placeholder="+ nowy folder" />
        </div>
      </aside>

      {/* Main content — selected list / smart view (full width).
          F12-K22: MS-To-Do parity — main rozciągnięty na całą szerokość
          (minus sidebar i ewentualny detail panel). Add-task input
          przyklejony u dołu sticky. */}
      <section
        className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
          mobileView !== "items" ? "max-md:hidden" : ""
        }`}
      >
        {/* Mobile-only: back chevron header */}
        <div className="md:hidden flex items-center gap-1 border-b border-border px-2 py-2">
          <Link
            href="/my/todo"
            aria-label="Wróć do list"
            className="flex items-center gap-1 rounded-md px-1 py-1 text-primary transition-colors hover:bg-accent"
          >
            <ChevronLeft size={22} />
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
              Listy
            </span>
          </Link>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 md:px-8 md:py-4">
          <div className="flex flex-wrap items-center gap-3">
            {activeSmart && (
              <activeSmart.icon size={22} className={activeSmart.accent} aria-hidden />
            )}
            <h1 className="font-display text-[1.5rem] font-bold leading-tight tracking-[-0.02em] md:text-[1.8rem]">
              {pageTitle}
            </h1>
            {smart !== "assigned" && (
              <div className="flex items-center gap-1.5">
                <CounterChip
                  label="wszystkie"
                  value={items.length}
                  tone="default"
                />
                <CounterChip
                  label="do zrobienia"
                  value={incomplete.length}
                  tone="primary"
                />
                <CounterChip
                  label="ukończone"
                  value={completed.length}
                  tone="muted"
                />
              </div>
            )}
            {smart === "assigned" && assignedTasks.length > 0 && (
              <CounterChip
                label="przypisanych"
                value={assignedTasks.length}
                tone="primary"
              />
            )}
          </div>

          {/* F12-K28: bulk-delete ukończone — pokazane gdy są jakieś
              completed itemy na bieżącym widoku. Scope = activeListId
              (dla list view) lub all-completed (dla smart view). */}
          {smart !== "assigned" && completed.length > 0 && (
            <form
              action={(fd) =>
                startTransition(() => bulkDeleteCompletedTodoItemsAction(fd))
              }
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Usunąć ${completed.length} ukończ${
                      completed.length === 1 ? "one zadanie" : "onych zadań"
                    }? Tej operacji nie można cofnąć.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
              className="m-0"
            >
              {activeListId && (
                <input type="hidden" name="listId" value={activeListId} />
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                title="Usuń wszystkie ukończone zadania"
              >
                <Trash2 size={12} />
                Usuń ukończone ({completed.length})
              </button>
            </form>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-8 md:py-4">
          {smart === "assigned" ? (
            <AssignedTasksPanel tasks={assignedTasks} />
          ) : items.length === 0 ? (
            <EmptyState smart={smart} hasList={!!activeListId} />
          ) : (
            <div className="flex flex-col gap-4">
              <ItemsList
                items={incomplete}
                selectedItemId={selectedItemId}
                onSelect={setSelectedItemId}
                showListChip={!activeListId}
              />
              {completed.length > 0 && (
                <CompletedSection
                  items={completed}
                  selectedItemId={selectedItemId}
                  onSelect={setSelectedItemId}
                  showListChip={!activeListId}
                />
              )}
            </div>
          )}
        </div>

        {/* F12-K22: sticky bottom add-task — MS To Do style. Pokazuje się
            tylko gdy lista jest aktywna (smart views nie mają kanonicznego
            targetu). */}
        {activeListId && (
          <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:px-8">
            <QuickAddItem
              listId={activeListId}
              listName={activeListName ?? ""}
              variant="bottom"
              onOptimistic={addOptimisticItem}
            />
          </div>
        )}
      </section>

      {/* F12-K22: prawy detail panel TYLKO gdy task wybrany. Inaczej
          main jest na całą dostępną szerokość.
          F12-K46: na mobile detail panel = full-screen + back-chevron
          header (zamiast 380px sidecar). */}
      {selectedItem && (
        <div
          className={`flex w-full flex-col overflow-y-auto md:w-[380px] md:shrink-0 md:border-l md:border-border md:bg-card/50 ${
            mobileView !== "detail" ? "max-md:hidden" : ""
          }`}
        >
          <div className="md:hidden flex items-center gap-1 border-b border-border bg-card/95 px-2 py-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
              aria-label="Wróć do listy"
              className="flex items-center gap-1 rounded-md px-1 py-1 text-primary transition-colors hover:bg-accent"
            >
              <ChevronLeft size={22} />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                Lista
              </span>
            </button>
          </div>
          <TodoDetailPanel
            key={selectedItem.id}
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
          />
        </div>
      )}
    </div>
  );
}

// --- Sidebar building blocks ---

function FolderBlock({
  folder,
  lists,
  activeListId,
}: {
  folder: TodoFolderNode;
  lists: TodoListNode[];
  activeListId: string | null;
}) {
  // Open by default if the active list belongs to this folder.
  const [open, setOpen] = useState(
    !activeListId || lists.some((l) => l.id === activeListId),
  );
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-1 rounded-md px-1 py-2 text-[0.95rem] hover:bg-accent/40 md:py-1 md:text-[0.86rem]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zwiń" : "Rozwiń"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground md:h-5 md:w-5"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Folder size={13} className="shrink-0 text-primary/70" />
        <span className="flex-1 truncate font-medium">{folder.name}</span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          aria-label="Dodaj listę do folderu"
          title="Nowa lista w folderze"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
        >
          <Plus size={11} />
        </button>
        <form
          action={(fd) => startTransition(() => deleteTodoFolderAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="id" value={folder.id} />
          <button
            type="submit"
            aria-label="Usuń folder"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-opacity hover:text-destructive focus-visible:opacity-100 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </form>
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 pl-5">
          {lists.map((l) => (
            <ListLink key={l.id} list={l} activeListId={activeListId} />
          ))}
          {showAdd && (
            <NewListForm folderId={folder.id} placeholder="+ nowa lista" />
          )}
        </div>
      )}
    </div>
  );
}

function ListLink({
  list,
  activeListId,
}: {
  list: TodoListNode;
  activeListId: string | null;
}) {
  const active = list.id === activeListId;
  return (
    <div className="group flex items-center gap-1 rounded-md">
      <Link
        href={`/my/todo?listId=${list.id}`}
        data-active={active ? "true" : "false"}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-2 text-[0.95rem] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-foreground md:py-1 md:text-[0.86rem]"
      >
        <ListIcon size={12} className="shrink-0" />
        <span className="truncate">{list.name}</span>
      </Link>
      <form
        action={(fd) => startTransition(() => deleteTodoListAction(fd))}
        className="m-0"
      >
        <input type="hidden" name="id" value={list.id} />
        <button
          type="submit"
          aria-label="Usuń listę"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-opacity hover:text-destructive focus-visible:opacity-100 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </form>
    </div>
  );
}

// F11-X (klient): wszystkie inline-add formy mają teraz widoczny + button
// żeby user mógł kliknąć myszką zamiast szukać Enter.
function NewFolderForm({ placeholder }: { placeholder: string }) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoFolderAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 rounded-md transition-colors focus-within:bg-background"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder={placeholder}
        className="h-8 flex-1 rounded-md border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj folder"
        title="Dodaj folder (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={13} />
      </button>
    </form>
  );
}

function NewListForm({
  folderId,
  placeholder,
}: {
  folderId: string | null;
  placeholder: string;
}) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createTodoListAction(fd);
          setName("");
        })
      }
      className="flex items-center gap-1 rounded-md transition-colors focus-within:bg-background"
    >
      {folderId && <input type="hidden" name="folderId" value={folderId} />}
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        placeholder={placeholder}
        className="h-8 flex-1 rounded-md border border-transparent bg-background px-2 text-[0.82rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary/40"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Dodaj listę"
        title="Dodaj listę (Enter)"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={13} />
      </button>
    </form>
  );
}

// --- Main area ---

function ItemsList({
  items,
  selectedItemId,
  onSelect,
  showListChip,
}: {
  items: TodoItemFull[];
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
  showListChip: boolean;
}) {
  return (
    <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border last:border-b-0">
          <ItemRow
            item={item}
            selected={item.id === selectedItemId}
            onSelect={() => onSelect(item.id === selectedItemId ? null : item.id)}
            showListChip={showListChip}
          />
        </li>
      ))}
    </ul>
  );
}

function CompletedSection({
  items,
  selectedItemId,
  onSelect,
  showListChip,
}: {
  items: TodoItemFull[];
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
  showListChip: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Ukończone ({items.length})
      </button>
      {open && (
        <ItemsList
          items={items}
          selectedItemId={selectedItemId}
          onSelect={onSelect}
          showListChip={showListChip}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
  showListChip,
}: {
  item: TodoItemFull;
  selected: boolean;
  onSelect: () => void;
  showListChip: boolean;
}) {
  const now = new Date();
  const overdue = item.dueDate && new Date(item.dueDate) < now && !item.completed;
  const isMyDay = !!item.myDayAt;
  const stepCount = item.steps.length;
  const stepsDone = item.steps.filter((s) => s.completed).length;

  return (
    <div
      data-selected={selected ? "true" : "false"}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 data-[selected=true]:bg-primary/5"
    >
      <form
        action={(fd) => startTransition(() => toggleTodoItemAction(fd))}
        className="m-0 flex shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="completed" value={item.completed ? "false" : "true"} />
        <button
          type="submit"
          aria-label={item.completed ? "Odznacz" : "Oznacz jako ukończone"}
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        >
          {item.completed ? (
            <CheckCircle2 size={18} className="text-primary" />
          ) : (
            <Circle size={18} />
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none"
      >
        <span
          className={`block w-full truncate text-[0.94rem] transition-colors ${
            item.completed ? "text-muted-foreground line-through" : ""
          }`}
        >
          <RenderContent content={item.content} />
        </span>
        {/* F12-K28+: pokazuj preview notatek (zamiast tylko labela
            "notatka") — klient chciał widzieć co dokładnie tam jest bez
            klikania w detail panel. Truncate do 2 linii + collapse
            multi-newline w whitespace. */}
        {item.notes && item.notes.trim() !== "" && (
          <span className="line-clamp-2 w-full whitespace-pre-wrap break-words text-[0.78rem] leading-snug text-muted-foreground">
            {item.notes.trim()}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {showListChip && (
            <span className="inline-flex items-center gap-1">
              <ListIcon size={10} /> {item.listName}
            </span>
          )}
          {isMyDay && (
            <span className="inline-flex items-center gap-1 text-amber-500">
              <Sun size={10} /> Mój dzień
            </span>
          )}
          {item.dueDate && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue ? "text-destructive" : ""
              }`}
            >
              <CalendarDays size={10} /> {formatShortDate(item.dueDate)}
            </span>
          )}
          {stepCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare size={10} /> {stepsDone}/{stepCount}
            </span>
          )}
        </div>
      </button>

      <form
        action={(fd) => startTransition(() => toggleTodoMyDayAction(fd))}
        className="m-0 shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="next" value={isMyDay ? "false" : "true"} />
        <button
          type="submit"
          aria-label={isMyDay ? "Usuń z Mój dzień" : "Dodaj do Mój dzień"}
          title={isMyDay ? "Usuń z Mój dzień" : "Dodaj do Mój dzień"}
          data-on={isMyDay ? "true" : "false"}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-amber-500 data-[on=true]:text-amber-500"
        >
          <Sun size={14} />
        </button>
      </form>

      <form
        action={(fd) => startTransition(() => toggleTodoImportantAction(fd))}
        className="m-0 shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="next" value={item.important ? "false" : "true"} />
        <button
          type="submit"
          aria-label={item.important ? "Usuń z Ważne" : "Oznacz jako ważne"}
          title={item.important ? "Usuń z Ważne" : "Oznacz jako ważne"}
          data-on={item.important ? "true" : "false"}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-rose-500 data-[on=true]:text-rose-500"
        >
          <Star size={14} fill={item.important ? "currentColor" : "none"} />
        </button>
      </form>

      {/* F12-K28: pojedyncza opcja usunięcia zadania. Visible on row hover
          (group-hover) — żeby nie pęknąć się z gwiazdką/słoneczkiem.
          F12-K46: ukryty na mobile (no-hover stack confuses tap-targety);
          delete dostępny w detail panel po tapnięciu zadania. */}
      <form
        action={(fd) => startTransition(() => deleteTodoItemAction(fd))}
        onSubmit={(e) => {
          if (!confirm("Usunąć to zadanie? Tej operacji nie można cofnąć.")) {
            e.preventDefault();
          }
        }}
        className="m-0 shrink-0 max-md:hidden"
      >
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          aria-label="Usuń zadanie"
          title="Usuń zadanie"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </form>
    </div>
  );
}

function QuickAddItem({
  listId,
  listName,
  variant = "main",
  onOptimistic,
}: {
  listId: string;
  listName: string;
  // F11-11 → F12-K22: 'bottom' variant = sticky bottom of main content
  // (MS-To-Do style — input full-width pod listą zadań). 'panel' = card
  // wewnątrz right panelu (legacy — usunięte w F12-K22). 'main' = top
  // header inline (legacy — usunięte w F12-K22).
  variant?: "main" | "panel" | "bottom";
  // F12-K18: callback do parent useOptimistic — input renders new item
  // natychmiast lokalnie, server save w tle.
  onOptimistic?: (pending: {
    tempId: string;
    content: string;
    listId: string;
    listName: string;
  }) => void;
}) {
  const [content, setContent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Clear input + focus IMMEDIATELY — feel of native rapid entry.
    setContent("");
    setTimeout(() => inputRef.current?.focus(), 0);

    const fd = new FormData();
    fd.set("listId", listId);
    fd.set("content", trimmed);

    // useOptimistic must be wrapped in startTransition.
    startTransition(() => {
      onOptimistic?.({ tempId, content: trimmed, listId, listName });
      void createTodoItemAction(fd);
    });
  };

  const cls =
    variant === "bottom"
      ? "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors focus-within:border-primary/60 focus-within:shadow-[0_2px_8px_-2px_rgba(10,10,40,0.08)]"
      : variant === "panel"
        ? "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary/60"
        : "flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-[0_1px_2px_rgba(10,10,40,0.04)]";

  const iconSize = variant === "panel" ? 13 : variant === "bottom" ? 16 : 15;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cls}
    >
      <Plus size={iconSize} className="text-primary/70" />
      <input
        ref={inputRef}
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        maxLength={300}
        placeholder="Dodaj zadanie"
        autoFocus={variant === "panel"}
        className={
          variant === "bottom"
            ? "flex-1 bg-transparent py-1 text-[0.96rem] outline-none placeholder:text-muted-foreground/60"
            : variant === "panel"
              ? "flex-1 bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/60"
              : "flex-1 bg-transparent py-1 text-[0.95rem] outline-none placeholder:text-muted-foreground/60"
        }
      />
      <button
        type="submit"
        disabled={!content.trim()}
        aria-label="Dodaj zadanie"
        title="Dodaj (Enter)"
        className={
          variant === "bottom"
            ? "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            : variant === "panel"
              ? "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              : "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        <Plus size={iconSize} />
      </button>
    </form>
  );
}

function EmptyState({
  smart,
  hasList,
}: {
  smart: SmartView | null;
  hasList: boolean;
}) {
  if (smart === "my-day") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <Sun size={26} className="text-amber-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">
          Mój dzień jest czysty.
        </p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Dodawaj zadania z innych list do „Mój dzień" (ikona słoneczka obok zadania).
        </p>
      </div>
    );
  }
  if (smart === "important") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <Star size={26} className="text-rose-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">Brak ważnych zadań.</p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Kliknij gwiazdkę obok zadania żeby dodać je tutaj.
        </p>
      </div>
    );
  }
  if (smart === "planned") {
    return (
      <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <CalendarDays size={26} className="text-sky-500" />
        <p className="mt-3 font-display text-[1.05rem] font-semibold">
          Nic nie jest zaplanowane.
        </p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">
          Ustaw termin w szczegółach zadania (prawy panel).
        </p>
      </div>
    );
  }
  return (
    <div className="mt-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-display text-[1.05rem] font-semibold">
        {hasList ? "Lista jest pusta." : "Wybierz listę po lewej."}
      </p>
      <p className="mt-1 text-[0.88rem] text-muted-foreground">
        {hasList
          ? "Dodaj pierwsze zadanie w pasku u góry."
          : "Utwórz nową listę lub folder w dolnej części panelu."}
      </p>
    </div>
  );
}

// F12-K28: chip-style counter w header'ze TODO. Klient: 'brak cyferki ile
// jest zgłoszeń, pokazywać ilość elementów'. Trzy chipy: total /
// do-zrobienia / ukończone — szybki overview stanu listy.
function CounterChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "primary" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/30 bg-primary/10 text-primary"
      : tone === "muted"
        ? "border-border bg-muted/40 text-muted-foreground"
        : "border-border bg-background text-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${cls}`}
      title={`${value} ${label}`}
    >
      <span className="text-[0.78rem] font-semibold tracking-normal normal-case">
        {value}
      </span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

// F12-K18: render content z auto-detekcją URL'i. Plain text + URL jako
// klikalny chip pokazujący tylko hostname (zamiast 80-znakowego URL'a).
// Klik na chip = open in new tab (stop propagation żeby nie selectowało
// taska).
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function shortHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function RenderContent({ content }: { content: string }) {
  const parts = useMemo(() => {
    const matches = [...content.matchAll(URL_REGEX)];
    if (matches.length === 0) {
      return [{ type: "text" as const, value: content }];
    }
    const out: Array<
      { type: "text"; value: string } | { type: "link"; href: string }
    > = [];
    let last = 0;
    for (const m of matches) {
      const start = m.index ?? 0;
      if (start > last) {
        out.push({ type: "text", value: content.slice(last, start) });
      }
      out.push({ type: "link", href: m[0] });
      last = start + m[0].length;
    }
    if (last < content.length) {
      out.push({ type: "text", value: content.slice(last) });
    }
    return out;
  }, [content]);

  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline font-mono text-[0.78em] text-primary underline-offset-2 hover:bg-primary/10 hover:underline"
          >
            <ExternalLink size={10} className="shrink-0" />
            {shortHost(p.href)}
          </a>
        ),
      )}
    </>
  );
}

// F12-K17: lista tasków przypisanych do current user w prawym panelu.
// Każdy task linkuje do swojego workspace'u + boardu. Empty state =
// hint że nic nie ma.
function AssignedTasksPanel({ tasks }: { tasks: AssignedTaskRef[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-4 py-6">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          Twoje przypisane zadania
        </p>
        <p className="text-[0.84rem] text-muted-foreground">
          Brak zadań przypisanych do Ciebie w workspace'ach. Klik w zadanie tej listy żeby zobaczyć szczegóły.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/80">
          Twoje przypisane zadania
        </p>
        <span className="font-mono text-[0.62rem] text-muted-foreground/60">
          {tasks.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link
              href={`/w/${t.workspaceId}/t/${t.id}`}
              className="group flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 transition-all hover:-translate-y-[1px] hover:border-primary/60"
            >
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 truncate font-display text-[0.86rem] font-semibold leading-tight tracking-[-0.01em] group-hover:text-primary">
                  {t.title}
                </span>
                {t.statusName && t.statusColor && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.6rem] font-medium"
                    style={{
                      background: `${t.statusColor}1A`,
                      color: t.statusColor,
                    }}
                  >
                    {t.statusName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="truncate">{t.workspaceName}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{t.boardName}</span>
                {t.stopAt && (
                  <>
                    <span aria-hidden>·</span>
                    <span>do {formatShortDate(t.stopAt)}</span>
                  </>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
