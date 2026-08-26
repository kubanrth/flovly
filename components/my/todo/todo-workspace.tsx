"use client";

// D3 „TO DO” — prywatna lista: szybkie dodawanie (Enter), sekcje Dzisiaj /
// Ten tydzień / Później, akcje na hover (termin, przenieś na jutro, usuń),
// zwijane „Ukończone wcześniej”, panel szczegółów w prawym arkuszu.

import { startTransition, useMemo, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import {
  bulkDeleteCompletedTodoItemsAction,
  createTodoFolderAction,
  createTodoItemAction,
  createTodoListAction,
  deleteTodoFolderAction,
  deleteTodoItemAction,
  deleteTodoListAction,
  setTodoDueDateAction,
  toggleTodoItemAction,
} from "@/app/(app)/my/todo/actions";
import type { SmartView } from "@/app/(app)/my/todo/page";
import { TodoDetailPanel, type TodoItemFull } from "@/components/my/todo/todo-detail-panel";
import { bucketItems, dayCounter, dueLabel } from "@/components/my/todo/todo-buckets";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconExternal,
  IconLock,
  IconPlus,
  IconTrash,
  IconArrowRight,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

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

const SMART_VIEWS: { key: SmartView; label: string }[] = [
  { key: "my-day", label: "Mój dzień" },
  { key: "important", label: "Ważne" },
  { key: "planned", label: "Zaplanowane" },
  { key: "assigned", label: "Przydzielone do mnie" },
];

// Nested folders dropped from UX — ignore parentId in tree; createTodoFolderAction forces null.
export function TodoWorkspace({
  folders,
  lists,
  activeListId,
  activeListName,
  smart,
  items,
  focusedItemId,
  assignedTasks,
  nowIso,
}: {
  folders: TodoFolderNode[];
  lists: TodoListNode[];
  activeListId: string | null;
  activeListName: string | null;
  smart: SmartView | null;
  items: TodoItemFull[];
  focusedItemId: string | null;
  assignedTasks: AssignedTaskRef[];
  /** Liczony na serwerze — SSR i klient muszą trafić w te same sekcje. */
  nowIso: string;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(focusedItemId);

  // Optimistic UI for add-task — server save runs in background; revalidatePath replaces optimistic with real row.
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
      updatedAt: new Date().toISOString(),
      steps: [],
    },
  ]);

  // Odhaczenie ma przekreślać pozycję od razu — bez czekania na revalidate.
  // `updatedAt` też podmieniamy, inaczej pozycja wpadłaby do „Ukończone wcześniej”.
  const [pendingDone, setPendingDone] = useState<Record<string, boolean>>({});
  const shownItems = optimisticItems.map((i) =>
    i.id in pendingDone
      ? { ...i, completed: pendingDone[i.id]!, updatedAt: pendingDone[i.id] ? nowIso : i.updatedAt }
      : i,
  );
  const toggleDone = (item: TodoItemFull, next: boolean) => {
    setPendingDone((p) => ({ ...p, [item.id]: next }));
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("completed", next ? "true" : "false");
    startTransition(() => toggleTodoItemAction(fd));
  };

  const selectedItem = shownItems.find((i) => i.id === selectedItemId) ?? null;

  const now = new Date(nowIso);
  const buckets = bucketItems(shownItems, now);
  const { done, total } = dayCounter(buckets, now);
  const viewLabel = activeListName ?? SMART_VIEWS.find((v) => v.key === smart)?.label ?? "Wszystkie";
  // Bez aktywnej listy dodajemy do pierwszej listy użytkownika (MS To Do parity).
  const targetList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;

  return (
    // RouteFrame owija stronę paddingiem — zdejmujemy go marginesem, żeby stopka
    // siadła na dole ekranu. ponytail: docelowo /my/todo dopisać do FULL_BLEED
    // w components/layout/route-frame.tsx.
    <div
      data-ui="todo"
      className="flex h-[calc(100dvh-48px)] min-h-0 flex-1 flex-col bg-background"
    >
      <header className="flex flex-none flex-wrap items-center gap-2.5 px-4 pt-4 md:px-8">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">TO DO</h1>
        <Chip hue="gray" size="lg" className="mt-1 gap-1.5">
          <IconLock width={11} height={11} />
          Prywatna — tylko Ty
        </Chip>
        <ViewPicker
          label={viewLabel}
          folders={folders}
          lists={lists}
          activeListId={activeListId}
          smart={smart}
        />
        <span className="flex-1" />
        {done > 0 && (
          <form
            action={(fd) => startTransition(() => bulkDeleteCompletedTodoItemsAction(fd))}
            onSubmit={(e) => {
              if (!confirm("Usunąć ukończone pozycje? Tej operacji nie można cofnąć.")) e.preventDefault();
            }}
            className="m-0"
          >
            {activeListId && <input type="hidden" name="listId" value={activeListId} />}
            <button
              type="submit"
              className="inline-flex h-6 items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground hover:text-danger-text active:text-danger"
            >
              <IconTrash width={12} height={12} />
              Usuń ukończone
            </button>
          </form>
        )}
        <span className="mt-1.5 font-mono text-2xs text-fg-3">
          {done}/{total} dziś
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-8">
        <div className="max-w-[680px]">
          <QuickAdd list={targetList} onOptimistic={addOptimisticItem} />

          {smart === "assigned" ? (
            <AssignedTasksPanel tasks={assignedTasks} />
          ) : (
            <>
              <Section label="Dzisiaj" items={buckets.today} now={now} onSelect={setSelectedItemId} onToggle={toggleDone} selectedId={selectedItemId} />
              <Section label="Ten tydzień" items={buckets.week} now={now} onSelect={setSelectedItemId} onToggle={toggleDone} selectedId={selectedItemId} />
              {buckets.later.length > 0 && (
                <Section label="Później" items={buckets.later} now={now} onSelect={setSelectedItemId} onToggle={toggleDone} selectedId={selectedItemId} />
              )}
              <CompletedEarlier items={buckets.earlier} now={now} onSelect={setSelectedItemId} onToggle={toggleDone} selectedId={selectedItemId} />
              <p className="text-xs text-fg-3">
                Notatka: pozycje TO DO można przeciągnąć na zadanie w tablicy, żeby je podpiąć — wtedy dostają #ID.
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="flex h-8 flex-none items-center border-t border-border bg-canvas px-4 md:px-8">
        <span className="font-mono text-2xs text-fg-2">
          {total} {plPlural(total, "pozycja", "pozycje", "pozycji")} · {done}{" "}
          {plPlural(done, "ukończona", "ukończone", "ukończonych")} dziś · lista prywatna
        </span>
      </footer>

      <Sheet open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItemId(null)}>
        <SheetContent side="right" className="w-[420px]">
          <SheetTitle className="sr-only">Szczegóły pozycji TO DO</SheetTitle>
          {selectedItem && (
            <TodoDetailPanel
              key={selectedItem.id}
              item={selectedItem}
              onClose={() => setSelectedItemId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({
  label,
  items,
  now,
  onSelect,
  onToggle,
  selectedId,
}: {
  label: string;
  items: TodoItemFull[];
  now: Date;
  onSelect: (id: string) => void;
  onToggle: (item: TodoItemFull, next: boolean) => void;
  selectedId: string | null;
}) {
  return (
    <section className="mb-4">
      <h2 className="eyebrow mb-1 flex h-7 items-end">{label}</h2>
      {items.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-fg-3">Nic tu nie ma.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} now={now} onSelect={onSelect} onToggle={onToggle} selected={item.id === selectedId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompletedEarlier({
  items,
  now,
  onSelect,
  onToggle,
  selectedId,
}: {
  items: TodoItemFull[];
  now: Date;
  onSelect: (id: string) => void;
  onToggle: (item: TodoItemFull, next: boolean) => void;
  selectedId: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-1 flex h-7 items-center gap-2 rounded-sm text-muted-foreground hover:text-foreground"
      >
        <span className="eyebrow">Ukończone wcześniej · {items.length}</span>
        {open ? <IconChevronDown width={12} height={12} /> : <IconChevronRight width={12} height={12} />}
      </button>
      {open && (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} now={now} onSelect={onSelect} onToggle={onToggle} selected={item.id === selectedId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({
  item,
  now,
  onSelect,
  onToggle,
  selected,
}: {
  item: TodoItemFull;
  now: Date;
  onSelect: (id: string) => void;
  onToggle: (item: TodoItemFull, next: boolean) => void;
  selected: boolean;
}) {
  const label = item.dueDate ? dueLabel(item.dueDate, now) : null;
  const stepsDone = item.steps.filter((s) => s.completed).length;

  const setDue = (value: string) => {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("dueDate", value);
    startTransition(() => setTodoDueDateAction(fd));
  };

  const tomorrow = () => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    setDue(d.toISOString());
  };

  return (
    <div
      data-ui="todo-item"
      data-selected={selected ? "true" : "false"}
      className="group flex min-h-9 items-center gap-2.5 rounded-md px-2 hover:bg-n-100 data-[selected=true]:bg-selected"
    >
      <Checkbox
        checked={item.completed}
        onCheckedChange={() => onToggle(item, !item.completed)}
        ariaLabel={item.completed ? "Odznacz" : "Oznacz jako ukończone"}
      />
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          "min-w-0 flex-1 truncate rounded-sm py-1.5 text-left text-sm",
          item.completed ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        <RenderContent content={item.content} />
      </button>
      {item.steps.length > 0 && (
        <span className="shrink-0 font-mono text-2xs text-fg-3">
          {stepsDone}/{item.steps.length}
        </span>
      )}
      {item.notes && item.notes.trim() !== "" && (
        <span className="shrink-0 text-2xs text-fg-3">notatka</span>
      )}
      {label && !item.completed && (
        <span
          className={cn(
            "shrink-0 text-xs text-fg-2",
            (label === "dziś" || label === "po terminie") &&
              "inline-flex h-[18px] items-center rounded-sm bg-chip-orange-bg px-1.5 text-2xs font-medium text-chip-orange-fg",
          )}
        >
          {label}
        </span>
      )}
      <span className="inline-flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 ease-[var(--ease-out)] pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <Popover>
          <PopoverTrigger
            aria-label="Ustaw termin"
            title="Ustaw termin"
            className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-card text-fg-2 hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            <IconCalendar width={12} height={12} strokeWidth={1.4} />
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-[220px] flex-col gap-2">
            <span className="eyebrow">Termin</span>
            <Input
              size="sm"
              type="date"
              defaultValue={item.dueDate ? item.dueDate.slice(0, 10) : ""}
              onChange={(e) => setDue(e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : "")}
              aria-label="Termin"
            />
            {item.dueDate && (
              <button
                type="button"
                onClick={() => setDue("")}
                className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-card text-xs font-medium text-n-700 hover:bg-n-100 active:bg-n-200"
              >
                Usuń termin
              </button>
            )}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={tomorrow}
          aria-label="Przenieś na jutro"
          title="Przenieś na jutro"
          className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-card text-fg-2 hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          <IconArrowRight width={12} height={12} strokeWidth={1.4} />
        </button>
        <form
          action={(fd) => startTransition(() => deleteTodoItemAction(fd))}
          onSubmit={(e) => {
            if (!confirm("Usunąć tę pozycję? Tej operacji nie można cofnąć.")) e.preventDefault();
          }}
          className="m-0"
        >
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label="Usuń pozycję"
            title="Usuń pozycję"
            className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-card text-danger-text hover:bg-chip-red-bg active:bg-chip-red-bg"
          >
            <IconTrash width={12} height={12} strokeWidth={1.4} />
          </button>
        </form>
      </span>
    </div>
  );
}

function QuickAdd({
  list,
  onOptimistic,
}: {
  list: TodoListNode | null;
  onOptimistic: (pending: { tempId: string; content: string; listId: string; listName: string }) => void;
}) {
  const [content, setContent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || !list) return;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Czyścimy pole od razu — wpisywanie pozycji jedna po drugiej ma być płynne.
    setContent("");
    setTimeout(() => inputRef.current?.focus(), 0);
    const fd = new FormData();
    fd.set("listId", list.id);
    fd.set("content", trimmed);
    startTransition(() => {
      onOptimistic({ tempId, content: trimmed, listId: list.id, listName: list.name });
      void createTodoItemAction(fd);
    });
  };

  return (
    <form
      data-ui="todo-quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-4 flex h-10 items-center gap-2.5 rounded-md border border-input-border bg-card px-3 hover:border-input-border-hover focus-within:border-orange-500 focus-within:shadow-[var(--focus)]"
    >
      <IconPlus width={14} height={14} strokeWidth={1.6} className="shrink-0 text-n-500" />
      <input
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={300}
        disabled={!list}
        placeholder={list ? "Dodaj pozycję…" : "Najpierw utwórz listę"}
        aria-label="Dodaj pozycję"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-n-500 focus-visible:shadow-none disabled:text-n-400"
      />
      <span className="shrink-0 font-mono text-2xs text-n-500">Enter — dodaj</span>
    </form>
  );
}

// Listy, foldery i widoki inteligentne — makieta D3 nie ma lewej kolumny,
// więc siedzą w jednym popoverze przy tytule.
function ViewPicker({
  label,
  folders,
  lists,
  activeListId,
  smart,
}: {
  label: string;
  folders: TodoFolderNode[];
  lists: TodoListNode[];
  activeListId: string | null;
  smart: SmartView | null;
}) {
  const rootFolders = folders.filter((f) => f.parentId === null);
  const listsByFolder = new Map<string | null, TodoListNode[]>();
  for (const l of lists) listsByFolder.set(l.folderId, [...(listsByFolder.get(l.folderId) ?? []), l]);

  return (
    <Popover>
      <PopoverTrigger className="mt-1 inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-card px-2 text-xs font-medium text-n-700 hover:bg-n-100 active:bg-n-200">
        {label}
        <IconChevronDown width={12} height={12} />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-[70dvh] w-[260px] flex-col gap-1 overflow-y-auto">
        <ViewLink href="/my/todo" active={!activeListId && !smart} label="Wszystkie" />
        {SMART_VIEWS.map((v) => (
          <ViewLink
            key={v.key}
            href={`/my/todo?smart=${v.key}`}
            active={smart === v.key && !activeListId}
            label={v.label}
          />
        ))}
        <span className="my-1 h-px bg-border" />
        {(listsByFolder.get(null) ?? []).map((l) => (
          <ListRow key={l.id} list={l} active={l.id === activeListId} />
        ))}
        {rootFolders.map((f) => (
          <div key={f.id} className="flex flex-col">
            <div className="flex h-7 items-center gap-1 px-1.5">
              <span className="eyebrow flex-1 truncate">{f.name}</span>
              <form action={(fd) => startTransition(() => deleteTodoFolderAction(fd))} className="m-0">
                <input type="hidden" name="id" value={f.id} />
                <button
                  type="submit"
                  aria-label={`Usuń folder ${f.name}`}
                  className="inline-flex size-6 items-center justify-center rounded-sm text-fg-3 hover:text-danger-text active:text-danger"
                >
                  <IconClose width={11} height={11} />
                </button>
              </form>
            </div>
            <div className="flex flex-col pl-2">
              {(listsByFolder.get(f.id) ?? []).map((l) => (
                <ListRow key={l.id} list={l} active={l.id === activeListId} />
              ))}
              <NewNameForm action={createTodoListAction} placeholder="+ lista w folderze" folderId={f.id} />
            </div>
          </div>
        ))}
        <span className="my-1 h-px bg-border" />
        <NewNameForm action={createTodoListAction} placeholder="+ nowa lista" folderId={null} />
        <NewNameForm action={createTodoFolderAction} placeholder="+ nowy folder" folderId={null} />
      </PopoverContent>
    </Popover>
  );
}

function ViewLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className="flex h-8 items-center rounded-md px-2 text-sm text-n-700 hover:bg-n-100 active:bg-n-200 data-[active=true]:bg-selected data-[active=true]:font-medium data-[active=true]:text-foreground"
    >
      {label}
    </Link>
  );
}

function ListRow({ list, active }: { list: TodoListNode; active: boolean }) {
  return (
    <div className="group/list flex items-center gap-1">
      <Link
        href={`/my/todo?listId=${list.id}`}
        data-active={active ? "true" : "false"}
        className="flex h-8 min-w-0 flex-1 items-center rounded-md px-2 text-sm text-n-700 hover:bg-n-100 active:bg-n-200 data-[active=true]:bg-selected data-[active=true]:font-medium data-[active=true]:text-foreground"
      >
        <span className="truncate">{list.name}</span>
      </Link>
      <form action={(fd) => startTransition(() => deleteTodoListAction(fd))} className="m-0">
        <input type="hidden" name="id" value={list.id} />
        <button
          type="submit"
          aria-label={`Usuń listę ${list.name}`}
          className="inline-flex size-6 items-center justify-center rounded-sm text-fg-3 opacity-0 hover:text-danger-text focus-visible:opacity-100 group-hover/list:opacity-100 active:text-danger"
        >
          <IconTrash width={12} height={12} />
        </button>
      </form>
    </div>
  );
}

function NewNameForm({
  action,
  placeholder,
  folderId,
}: {
  action: (formData: FormData) => Promise<void>;
  placeholder: string;
  folderId: string | null;
}) {
  const [name, setName] = useState("");
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await action(fd);
          setName("");
        })
      }
      className="flex items-center gap-1"
    >
      {folderId && <input type="hidden" name="folderId" value={folderId} />}
      <Input
        size="sm"
        name="name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        required
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label={placeholder}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-n-100 hover:text-foreground active:bg-n-200 disabled:text-n-400"
      >
        <IconPlus width={13} height={13} />
      </button>
    </form>
  );
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function shortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function RenderContent({ content }: { content: string }) {
  const parts = useMemo(() => {
    const matches = [...content.matchAll(URL_REGEX)];
    if (matches.length === 0) return [{ type: "text" as const, value: content }];
    const out: Array<{ type: "text"; value: string } | { type: "link"; href: string }> = [];
    let last = 0;
    for (const m of matches) {
      const start = m.index ?? 0;
      if (start > last) out.push({ type: "text", value: content.slice(last, start) });
      out.push({ type: "link", href: m[0] });
      last = start + m[0].length;
    }
    if (last < content.length) out.push({ type: "text", value: content.slice(last) });
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
            className="mx-0.5 inline-flex items-center gap-1 align-baseline text-link hover:underline"
          >
            <IconExternal width={11} height={11} className="shrink-0" />
            {shortHost(p.href)}
          </a>
        ),
      )}
    </>
  );
}

function AssignedTasksPanel({ tasks }: { tasks: AssignedTaskRef[] }) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input-border p-4 text-center text-sm text-muted-foreground">
        Brak zadań przypisanych do Ciebie w przestrzeniach.
      </p>
    );
  }
  return (
    <section className="mb-4">
      <h2 className="eyebrow mb-1 flex h-7 items-end">Przydzielone do mnie · {tasks.length}</h2>
      <ul className="overflow-hidden rounded-lg border border-border">
        {tasks.map((t) => (
          <li key={t.id} className="border-b border-n-100 last:border-b-0">
            <Link
              href={`/w/${t.workspaceId}/t/${t.id}`}
              className="flex h-11 items-center gap-2.5 px-3 hover:bg-row-hover"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
              {t.statusName && <span className="shrink-0 text-xs text-fg-2">{t.statusName}</span>}
              <span className="hidden shrink-0 text-xs text-fg-3 sm:inline">{t.boardName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
