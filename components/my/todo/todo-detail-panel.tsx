"use client";

// Panel szczegółów pozycji TO DO (prawy arkusz): pod-zadania, Mój dzień,
// Ważne, termin, przypomnienie, notatki, usunięcie.

import { startTransition, useState, type FormEvent, type ReactNode } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconClose,
  IconCalendar,
  IconNotes,
  IconPlus,
  IconReminders,
  IconStar,
  IconStarFilled,
  IconSun,
  IconTrash,
} from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  /** Proxy „ukończone dziś” dla sekcji listy (schemat nie ma completedAt). */
  updatedAt: string;
  steps: TodoStepRow[];
}

export function TodoDetailPanel({ item, onClose }: { item: TodoItemFull; onClose: () => void }) {
  const isMyDay = !!item.myDayAt;

  const toggleDone = () => {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("completed", item.completed ? "false" : "true");
    startTransition(() => toggleTodoItemAction(fd));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start gap-2.5 pr-8">
        <span className="mt-1.5">
          <Checkbox
            checked={item.completed}
            onCheckedChange={toggleDone}
            ariaLabel={item.completed ? "Odznacz" : "Oznacz jako ukończone"}
          />
        </span>
        <TitleEditor id={item.id} initial={item.content} completed={item.completed} />
      </div>

      <p className="text-xs text-fg-3">w liście · {item.listName}</p>

      <div className="flex items-center gap-2">
        <ToggleButton
          id={item.id}
          next={!isMyDay}
          action={toggleTodoMyDayAction}
          on={isMyDay}
          icon={<IconSun width={13} height={13} />}
          label={isMyDay ? "W „Mój dzień”" : "Dodaj do „Mój dzień”"}
        />
        <ToggleButton
          id={item.id}
          next={!item.important}
          action={toggleTodoImportantAction}
          on={item.important}
          icon={item.important ? <IconStarFilled width={13} height={13} /> : <IconStar width={13} height={13} />}
          label={item.important ? "Ważne" : "Oznacz jako ważne"}
        />
      </div>

      <StepsSection itemId={item.id} steps={item.steps} />

      <DateRow
        label="Termin"
        icon={<IconCalendar width={13} height={13} />}
        id={item.id}
        value={item.dueDate}
        formName="dueDate"
        action={setTodoDueDateAction}
      />
      <DateRow
        label="Przypomnienie"
        icon={<IconReminders width={13} height={13} />}
        id={item.id}
        value={item.reminderAt}
        formName="reminderAt"
        action={setTodoReminderAction}
      />

      <NotesEditor id={item.id} initial={item.notes ?? ""} />

      <form
        action={(fd) =>
          startTransition(() => {
            deleteTodoItemAction(fd);
            onClose();
          })
        }
        onSubmit={(e) => {
          if (!confirm("Usunąć tę pozycję? Tej operacji nie można cofnąć.")) e.preventDefault();
        }}
        className="m-0 mt-auto pt-2"
      >
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-medium text-danger-text hover:bg-chip-red-bg active:bg-chip-red-bg"
        >
          <IconTrash width={13} height={13} /> Usuń pozycję
        </button>
      </form>
    </div>
  );
}

function ToggleButton({
  id,
  next,
  action,
  on,
  icon,
  label,
}: {
  id: string;
  next: boolean;
  action: (formData: FormData) => Promise<void>;
  on: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <form action={(fd) => startTransition(() => action(fd))} className="m-0 flex-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={next ? "true" : "false"} />
      <button
        type="submit"
        className={cn(
          "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium",
          on
            ? "border-control-on bg-control-on text-white hover:opacity-90"
            : "border-border bg-card text-n-700 hover:bg-n-100 active:bg-n-200",
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    </form>
  );
}

function TitleEditor({ id, initial, completed }: { id: string; initial: string; completed: boolean }) {
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
      aria-label="Treść pozycji"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(initial);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-md font-semibold outline-none hover:border-input-border focus:border-orange-500",
        completed && "text-muted-foreground line-through",
      )}
    />
  );
}

function StepsSection({ itemId, steps }: { itemId: string; steps: TodoStepRow[] }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const done = steps.filter((s) => s.completed).length;

  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
      <span className="eyebrow">Pod-zadania {steps.length > 0 && `· ${done}/${steps.length}`}</span>

      {steps.length > 0 && (
        <ul className="flex flex-col">
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
          className="flex items-center gap-1"
        >
          <Input
            size="sm"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            autoFocus
            maxLength={200}
            placeholder="Następne pod-zadanie…"
            aria-label="Nowe pod-zadanie"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTitle("");
                setAdding(false);
              }
            }}
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Dodaj pod-zadanie"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-n-100 hover:text-foreground active:bg-n-200 disabled:text-n-400"
          >
            <IconPlus width={13} height={13} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-7 items-center gap-1.5 self-start rounded-md border border-dashed border-input-border px-2 text-xs font-medium text-muted-foreground hover:border-orange-500 hover:text-foreground active:bg-n-100"
        >
          <IconPlus width={12} height={12} /> Dodaj pod-zadanie
        </button>
      )}
    </section>
  );
}

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

  const toggle = () => {
    const fd = new FormData();
    fd.set("id", step.id);
    fd.set("completed", step.completed ? "false" : "true");
    startTransition(() => toggleTodoStepAction(fd));
  };

  return (
    <li className="flex flex-col">
      <div className="group flex min-h-8 items-center gap-2 rounded-md px-1 hover:bg-n-100">
        <Checkbox
          size="sm"
          checked={step.completed}
          onCheckedChange={toggle}
          ariaLabel={step.completed ? "Odznacz pod-zadanie" : "Oznacz pod-zadanie"}
        />
        {editingTitle ? (
          <Input
            size="sm"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.currentTarget.value)}
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
            aria-label="Tytuł pod-zadania"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-sm text-left text-sm hover:text-orange-800",
              step.completed && "text-muted-foreground line-through",
            )}
          >
            {step.title}
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Zwiń opis" : "Pokaż opis"}
          data-has-notes={hasNotes}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-3 opacity-0 hover:bg-n-200 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[has-notes=true]:text-orange-800 data-[has-notes=true]:opacity-100"
        >
          <IconNotes width={12} height={12} />
        </button>

        <form action={(fd) => startTransition(() => deleteTodoStepAction(fd))} className="m-0">
          <input type="hidden" name="id" value={step.id} />
          <button
            type="submit"
            aria-label="Usuń pod-zadanie"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-3 opacity-0 hover:text-danger-text focus-visible:opacity-100 group-hover:opacity-100 active:text-danger"
          >
            <IconClose width={12} height={12} />
          </button>
        </form>
      </div>

      {expanded && <StepNotesEditor stepId={step.id} initial={step.notes ?? ""} />}
    </li>
  );
}

function StepNotesEditor({ stepId, initial }: { stepId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => {
        if (value === initial) return;
        const fd = new FormData();
        fd.set("id", stepId);
        fd.set("notes", value);
        startTransition(() => updateTodoStepNotesAction(fd));
      }}
      rows={2}
      maxLength={5000}
      placeholder="Opis pod-zadania…"
      aria-label="Opis pod-zadania"
      className="ml-6 mb-1 w-auto"
    />
  );
}

// Termin / Przypomnienie — natywny `datetime-local`, zapis na blur.
function DateRow({
  label,
  icon,
  id,
  value,
  formName,
  action,
}: {
  label: string;
  icon: ReactNode;
  id: string;
  value: string | null;
  formName: "dueDate" | "reminderAt";
  action: (formData: FormData) => Promise<void>;
}) {
  const local = value ? toLocalInput(value) : "";
  return (
    <form
      action={(fd) => startTransition(() => action(fd))}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
    >
      <input type="hidden" name="id" value={id} />
      <span className="shrink-0 text-fg-2">{icon}</span>
      <span className="eyebrow shrink-0">{label}</span>
      <input
        type="datetime-local"
        name={formName}
        defaultValue={local}
        aria-label={label}
        onBlur={(e) => {
          if (e.currentTarget.value === local) return;
          e.currentTarget.form?.requestSubmit();
        }}
        className="min-w-0 flex-1 rounded-sm bg-transparent px-1 font-mono text-xs text-foreground outline-none"
      />
      {value && (
        <button
          type="submit"
          name={formName}
          value=""
          aria-label={`Usuń: ${label.toLowerCase()}`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-3 hover:text-danger-text active:text-danger"
        >
          <IconClose width={12} height={12} />
        </button>
      )}
    </form>
  );
}

function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">Notatki</span>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={() => {
          if (value === initial) return;
          const fd = new FormData();
          fd.set("id", id);
          fd.set("notes", value);
          startTransition(() => updateTodoNotesAction(fd));
        }}
        rows={5}
        maxLength={5000}
        placeholder="Dodaj kontekst, linki, cokolwiek…"
        aria-label="Notatki"
      />
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
