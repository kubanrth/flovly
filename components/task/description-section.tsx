"use client";

import { startTransition, useState } from "react";
import { Edit3 } from "lucide-react";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { updateTaskDescriptionAction } from "@/app/(app)/w/[workspaceId]/t/actions";

// Task description — separate view/edit modes.
// MS Task / ClickUp pattern: once saved, description renders as prose
// with an "Edytuj" button. Clicking Edytuj switches back to the Tiptap
// editor with a Save/Cancel pair. Solves the bug where the editor stayed
// open with toolbar visible after save.
export function DescriptionSection({
  taskId,
  initial,
  canEdit,
}: {
  taskId: string;
  initial: RichTextDoc | null;
  canEdit: boolean;
}) {
  // Empty task → start in edit mode so the user doesn't have to click
  // "Edytuj" just to type the first character.
  const hasContent = hasRealContent(initial);
  const [mode, setMode] = useState<"view" | "edit">(
    hasContent ? "view" : canEdit ? "edit" : "view",
  );
  const [draft, setDraft] = useState<RichTextDoc | null>(initial);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const save = () => {
    setSaving(true);
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("descriptionJson", draft ? JSON.stringify(draft) : "");
    startTransition(async () => {
      await updateTaskDescriptionAction(fd);
      setSaving(false);
      setMode("view");
      setFlash("Zapisano.");
      setTimeout(() => setFlash(null), 1600);
    });
  };

  const cancel = () => {
    setDraft(initial);
    setMode("view");
  };

  // Klient: "zgubię w widoku to wszystko" — opis zlewał się z resztą kontentu
  // karty zadania. Dorzucamy delikatny fioletowo-szary tint (violet/5 +
  // violet/15 border) żeby sekcja była vizualnie wyodrębniona, ale nie
  // krzykliwa. Dopasowane do "Opis" badge'a w TaskActivityHints który też
  // ma violet'owy theme — cross-view spójność.
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] px-3 py-3 dark:border-violet-400/20 dark:bg-violet-400/[0.05] md:px-4 md:py-3.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-violet-700/80 dark:text-violet-300/80">Opis</span>
        {mode === "view" && canEdit && (
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Edit3 size={11} /> Edytuj
          </button>
        )}
        {flash && (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-primary">
            {flash}
          </span>
        )}
      </div>

      {mode === "view" ? (
        hasRealContent(draft) ? (
          <RichTextEditor
            initial={draft}
            readOnly
            variant="display"
          />
        ) : (
          <p className="text-[0.92rem] text-muted-foreground/70">
            {canEdit ? "Brak opisu. Kliknij Edytuj, aby dodać." : "Brak opisu."}
          </p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <RichTextEditor
            initial={draft}
            readOnly={false}
            onChange={(doc) => setDraft(doc)}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Zapisuję…" : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ProseMirror treats empty doc as `{ type: 'doc', content: [{ type: 'paragraph' }] }`.
// Accept any doc with at least one text child anywhere in the tree.
function hasRealContent(doc: RichTextDoc | null): boolean {
  if (!doc) return false;
  return containsText(doc);
}
function containsText(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text" && typeof n.text === "string" && n.text.length > 0) return true;
  if (Array.isArray(n.content)) {
    return n.content.some(containsText);
  }
  return false;
}
