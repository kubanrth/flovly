import { z } from "zod";

// F12-K75: priority field — accept enum string albo omit (server domyślnie NONE).
const taskPriorityZ = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createTaskSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(2000),
  // Optional explicit status column (Kanban inline-add). When
  // omitted, server falls back to the board's first column.
  statusColumnId: z.string().min(1).optional(),
  priority: taskPriorityZ.optional(),
});

// Loose ProseMirror doc shape. We don't deeply validate content nodes —
// Tiptap renders only known nodes and drops unknowns, so the runtime
// editor is our sanitizer. We DO cap the serialized size (50KB) to keep
// pathological blobs out of Postgres jsonb.
const richDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).optional(),
});

// Description moved out to updateTaskDescriptionAction. The main
// update form no longer touches descriptionJson — kept off the schema so
// a missing/empty field isn't accidentally treated as "clear description".
export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Tytuł jest wymagany.").max(2000),
  statusColumnId: z.string().min(1).optional().or(z.literal("")),
  startAt: z.string().optional().or(z.literal("")),
  stopAt: z.string().optional().or(z.literal("")),
  // Resolved offset to the absolute reminder timestamp; empty = clear.
  // Values: "none" | "1h" | "1d" | "3d" | ISO datetime (custom).
  reminderOffset: z.string().optional().or(z.literal("")),
  // F12-K75: priority — optional pole (omit = bez zmiany).
  priority: taskPriorityZ.optional(),
});

// F12-K75: dedykowana akcja "ustaw priority" — bez przepisywania całego
// tasku (np. inline picker w tabeli, mass action z bulk select).
export const setTaskPrioritySchema = z.object({
  taskId: z.string().min(1),
  priority: taskPriorityZ,
});

export const toggleAssigneeSchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
});

export const toggleTagSchema = z.object({
  taskId: z.string().min(1),
  tagId: z.string().min(1),
});

export const createTagSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa tagu wymagana.").max(32),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Podaj kolor w formacie #RRGGBB."),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
