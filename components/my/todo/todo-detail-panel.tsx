"use client";

import { startTransition, useState, type FormEvent } from "react";
import {
  Bell,
  BellOff,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Circle,
  Plus,
  Star,
  StickyNote,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import {
  createTodoStepAction,
  deleteTodoItemAction,
  deleteTodoStepAction,
  setTodoDueDateAction,
  setTodoReminderAction,
  toggleTodoImportantAction,
  toggleTodoItemAction,
  toggleTodoMyDayAction,
  toggleTodoStepAction,
  updateTodoNotesAction,
  updateTodoStepNotesAction,
  updateTodoStepTitleAction,
  updateTodoTitleAction,
} from "@/app/(app)/my/todo/actions";

export interface TodoStepRow {
  id: string;
  title: string;
  completed: boolean;
  // Opis pod-zadania.
  notes: string | null;
}

export interface TodoItemFull {
  id: string;
  content: string;
  completed: boolean;
  important: boolean;
  myDayAt: string | null;
  dueDate: string | null;
  reminderAt: string | null;
  notes: string | null;
  listId: string;
  listName: string;
  steps: TodoStepRow[];
}

// Right-hand detail panel — opens when the user clicks an item in the
// main list. Mirrors MS To Do's "task detail" pane: steps, add-to-my-day,
// star, due date, reminder, notes, delete.
export function TodoDetailPanel({
  item,
  onClose,
}: {
  item: TodoItemFull;
  onClose: () => void;
}) {
  const isMyDay = !!item.myDayAt;

  return (
    <aside className="sticky top-4 flex max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-[0_4px_16px_-8px_rgba(10,10,40,0.1)]">
      {/* Header — checkbox + title + close */}
      <div className="flex items-start gap-3">
        <form
          action={(fd) => startTransition(() => toggleTodoItemAction(fd))}
          className="m-0 mt-1 flex shrink-0"
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

        <TitleEditor id={item.id} initial={item.content} completed={item.completed} />

        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        w liście · {item.listName}
      </div>

      {/* Quick-toggle row: My Day + Important */}
      <div className="flex items-center gap-2">
        <form
          action={(fd) => startTransition(() => toggleTodoMyDayAction(fd))}
          className="m-0 flex-1"
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="next" value={isMyDay ? "false" : "true"} />
          <button
            type="submit"
            data-on={isMyDay ? "true" : "false"}
            className="group inline-flex w-full h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-amber-500/50 data-[on=true]:border-amber-500/60 data-[on=true]:bg-amber-500/10 data-[on=true]:text-amber-600"
          >
            <Sun size={13} />
            <span>{isMyDay ? "W Mój dzień" : "Do Mój dzień"}</span>
          </button>
        </form>

        <form
          action={(fd) => startTransition(() => toggleTodoImportantAction(fd))}
          className="m-0 flex-1"
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="next" value={item.important ? "false" : "true"} />
          <button
            type="submit"
            data-on={item.important ? "true" : "false"}
            className="group inline-flex w-full h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-rose-500/50 data-[on=true]:border-rose-500/60 data-[on=true]:bg-rose-500/10 data-[on=true]:text-rose-600"
          >
            <Star size={13} fill={item.important ? "currentColor" : "none"} />
            <span>{item.important ? "Ważne" : "Oznacz"}</span>
          </button>
        </form>
      </div>

      {/* Steps */}
      <StepsSection itemId={item.id} steps={item.steps} />

      {/* Due date */}
      <DateRow
        label="Termin"
        icon={<CalendarDays size={13} className="text-sky-500" />}
        id={item.id}
        value={item.dueDate}
        formName="dueDate"
        action={setTodoDueDateAction}
        tint="sky"
      />

      {/* Reminder */}
      <DateRow
        label="Przypomnienie"
        icon={
          item.reminderAt ? (
            <Bell size={13} className="text-violet-600 dark:text-violet-400" />
          ) : (
            <BellOff size={13} className="text-violet-500/60" />
          )
        }
        id={item.id}
        value={item.reminderAt}
        formName="reminderAt"
        action={setTodoReminderAction}
        tint="violet"
      />

      {/* Notes */}
      <NotesEditor id={item.id} initial={item.notes ?? ""} />

      {/* Delete */}
      <form
        action={(fd) => startTransition(() => {
          deleteTodoItemAction(fd);
          onClose();
        })}
        className="m-0 mt-auto"
      >
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 size={13} /> Usuń zadanie
        </button>
      </form>
    </aside>
  );
}

// Inline title editor — updates on blur / Enter, mirrors MS To Do's
// click-title-to-rename behaviour.
function TitleEditor({
  id,
  initial,
  completed,
}: {
  id: string;
  initial: string;
  completed: boolean;
}) {
  const [value, setValue] = useState(initial);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === initial) {
      setValue(initial);
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("content", trimmed);
    startTransition(() => updateTodoTitleAction(fd));
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setValue(initial);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={`flex-1 border-b border-transparent bg-transparent pb-1 font-display text-[1.1rem] leading-tight tracking-[-0.01em] outline-none focus:border-border ${
        completed ? "text-muted-foreground line-through" : ""
      }`}
    />
  );
}

// Pod-zadania (subtaski) z osobnymi opisami. Klient zażądał
// 'Plusik pod mniejszym zadaniem' + 'notatkę pod zadaniem... odnosi
// się też do pod-zadań'. Każdy step ma teraz:
//   - checkbox toggle (zostawione)
//   - inline title edit (na klik)
//   - expand button → opis editor (nowy)
//   - usuwanie (zostawione)
function StepsSection({
  itemId,
  steps,
}: {
  itemId: string;
  steps: TodoStepRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const done = steps.filter((s) => s.completed).length;

  // Klient: "zlana ściana" — pod-zadania dostają emerald tint + 3px lewy
  // border jako visual anchor. Spójny color-language cross-view z subtask-
  // pill'em w TaskActivityHints.
  return (
    <section className="flex flex-col gap-2 rounded-md border border-emerald-500/30 border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.05] p-3 dark:border-emerald-400/30 dark:border-l-emerald-400 dark:bg-emerald-400/[0.06]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
          <CheckSquare size={11} />
          Pod-zadania {steps.length > 0 && `· ${done}/${steps.length}`}
        </span>
      </div>

      {steps.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const t = title.trim();
            if (!t) {
              setAdding(false);
              return;
            }
            const fd = new FormData();
            fd.set("itemId", itemId);
            fd.set("title", t);
            startTransition(() => {
              createTodoStepAction(fd);
              setTitle("");
              setAdding(false);
            });
          }}
          className="flex items-center gap-2 rounded-md border border-primary/40 px-2 py-1 transition-colors"
        >
          <Plus size={13} className="shrink-0 text-primary/70" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={200}
            placeholder="Następne pod-zadanie…"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTitle("");
                setAdding(false);
              }
            }}
            className="flex-1 bg-transparent py-1 text-[0.85rem] outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Dodaj pod-zadanie"
            title="Dodaj (Enter)"
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={12} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-border px-2.5 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <Plus size={11} /> Dodaj pod-zadanie
        </button>
      )}
    </section>
  );
}

// Pojedynczy step row z możliwością expandowania notatek + edit
// title inline. Klik chevron → toggle notes editor; klik tytuł → edit.
function StepRow({ step }: { step: TodoStepRow }) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(step.title);
  const hasNotes = !!step.notes && step.notes.trim() !== "";

  const submitTitle = () => {
    const t = titleDraft.trim();
    if (!t || t === step.title) {
      setEditingTitle(false);
      setTitleDraft(step.title);
      return;
    }
    const fd = new FormData();
    fd.set("id", step.id);
    fd.set("title", t);
    startTransition(() => {
      updateTodoStepTitleAction(fd);
      setEditingTitle(false);
    });
  };

  return (
    <li className="flex flex-col gap-1 rounded-sm">
      <div className="group flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-accent/40">
        <form
          action={(fd) => startTransition(() => toggleTodoStepAction(fd))}
          className="m-0 shrink-0"
        >
          <input type="hidden" name="id" value={step.id} />
          <input
            type="hidden"
            name="completed"
            value={step.completed ? "false" : "true"}
          />
          <button
            type="submit"
            className="grid h-4 w-4 place-items-center text-muted-foreground hover:text-primary"
          >
            {step.completed ? (
              <CheckCircle2 size={14} className="text-primary" />
            ) : (
              <Circle size={14} />
            )}
          </button>
        </form>

        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitTitle();
              } else if (e.key === "Escape") {
                setTitleDraft(step.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            maxLength={200}
            className="flex-1 rounded-sm border border-primary/40 bg-background px-1 py-0.5 text-[0.85rem] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className={`flex-1 truncate text-left text-[0.85rem] hover:text-primary ${
              step.completed ? "text-muted-foreground line-through" : ""
            }`}
          >
            {step.title}
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Zwiń opis" : "Rozwiń opis"}
          title={hasNotes ? "Pokaż opis" : "Dodaj opis"}
          data-has-notes={hasNotes}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[has-notes=true]:text-primary data-[has-notes=true]:opacity-100"
        >
          <NoteIcon size={11} />
        </button>

        <form
          action={(fd) => startTransition(() => deleteTodoStepAction(fd))}
          className="m-0"
        >
          <input type="hidden" name="id" value={step.id} />
          <button
            type="submit"
            aria-label="Usuń pod-zadanie"
            className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={11} />
          </button>
        </form>
      </div>

      {expanded && <StepNotesEditor stepId={step.id} initial={step.notes ?? ""} />}
    </li>
  );
}

// Tiny inline icon — small "lined paper" feel for notes affordance.
function NoteIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5h6M4 7.5h6M4 9.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function StepNotesEditor({ stepId, initial }: { stepId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const persist = (next: string) => {
    const fd = new FormData();
    fd.set("id", stepId);
    fd.set("notes", next);
    startTransition(() => updateTodoStepNotesAction(fd));
  };
  return (
    <div className="ml-6 rounded-md border border-border bg-card p-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== initial) persist(value);
        }}
        rows={2}
        maxLength={5000}
        placeholder="Opis pod-zadania…"
        className="min-h-[44px] w-full resize-y bg-transparent text-[0.82rem] leading-[1.45] outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

// Generic reusable row for Due date / Reminder. Uses `datetime-local`
// input so the user gets a native picker, then posts ISO to the server.
function DateRow({
  label,
  icon,
  id,
  value,
  formName,
  action,
  tint = "neutral",
}: {
  label: string;
  icon: React.ReactNode;
  id: string;
  value: string | null;
  formName: "dueDate" | "reminderAt";
  action: (formData: FormData) => Promise<void>;
  // Color theme — klient: "zlana ściana", potrzeba odróżnić sekcje od siebie.
  // Każda sekcja dostaje swój subtelny background/border tint pasujący do
  // funkcji (sky = termin/kalendarz, violet = przypomnienie/dzwonek).
  tint?: "neutral" | "sky" | "violet";
}) {
  const local = value ? toLocalInput(value) : "";
  // Klient na mobile dalej widział "ścianę" mimo subtelnych tintów. Wzmacniam:
  // - kolorowy lewy border 3px (visual anchor po lewej stronie)
  // - większy padding pionowy żeby sekcje miały oddech
  // - label w tym samym kolorze co tint (mocniejszy color cue)
  const tintClass =
    tint === "sky"
      ? "border-sky-500/30 bg-sky-500/[0.05] border-l-[3px] border-l-sky-500 dark:border-sky-400/30 dark:bg-sky-400/[0.06] dark:border-l-sky-400"
      : tint === "violet"
        ? "border-violet-500/30 bg-violet-500/[0.05] border-l-[3px] border-l-violet-500 dark:border-violet-400/30 dark:bg-violet-400/[0.06] dark:border-l-violet-400"
        : "border-border bg-background";
  const labelColor =
    tint === "sky"
      ? "text-sky-700 dark:text-sky-300"
      : tint === "violet"
        ? "text-violet-700 dark:text-violet-300"
        : "text-muted-foreground";
  return (
    <form
      action={(fd) => startTransition(() => action(fd))}
      className={`flex items-center gap-3 rounded-md border px-3 py-3 ${tintClass}`}
    >
      <input type="hidden" name="id" value={id} />
      <span className="shrink-0">{icon}</span>
      <span
        className={`shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] font-semibold ${labelColor}`}
      >
        {label}
      </span>
      <input
        type="datetime-local"
        name={formName}
        defaultValue={local}
        onBlur={(e) => {
          if (e.currentTarget.value === local) return;
          (e.currentTarget.form as HTMLFormElement).requestSubmit();
        }}
        className="flex-1 bg-transparent font-mono text-[0.78rem] outline-none focus:text-foreground"
      />
      {value && (
        <button
          type="submit"
          name={formName}
          value=""
          aria-label={`Usuń ${label.toLowerCase()}`}
          title={`Usuń ${label.toLowerCase()}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-destructive"
        >
          <X size={11} />
        </button>
      )}
    </form>
  );
}

function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (value === initial) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("notes", value);
    startTransition(() => updateTodoNotesAction(fd));
  };
  // Notatki dostają amber tint + 3px lewy border anchor.
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-amber-500/30 border-l-[3px] border-l-amber-500 bg-amber-500/[0.05] p-3 dark:border-amber-400/30 dark:border-l-amber-400 dark:bg-amber-400/[0.06]">
      <span className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
        <StickyNote size={11} />
        Notatki
      </span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        rows={6}
        maxLength={5000}
        placeholder="Dodaj kontekst, linki, cokolwiek…"
        className="min-h-[7rem] resize-none rounded-md border border-border bg-background p-3 text-[0.88rem] leading-[1.55] outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
      />
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
