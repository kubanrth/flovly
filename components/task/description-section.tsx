"use client";

import { startTransition, useState } from "react";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { updateTaskDescriptionAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Button } from "@/components/ui/button";

// B2 Opis: prose in view mode; click → Tiptap with toolbar (focus ring), Zapisz/Anuluj
// only while dirty, autosave when focus leaves the editor.
export function DescriptionSection({ taskId, initial, canEdit, onMutate }: { taskId: string; initial: RichTextDoc | null; canEdit: boolean; onMutate?: () => void }) {
  const hasContent = hasRealContent(initial);
  const [editing, setEditing] = useState(!hasContent && canEdit);
  const [draft, setDraft] = useState<RichTextDoc | null>(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft ?? null) !== JSON.stringify(initial ?? null);

  const save = () => {
    if (!dirty) { setEditing(false); return; }
    setSaving(true);
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("descriptionJson", draft ? JSON.stringify(draft) : "");
    onMutate?.();
    startTransition(async () => {
      try {
        await updateTaskDescriptionAction(fd);
        setError(null);
        setEditing(false);
      } catch (err) {
        console.error("Description save failed:", err);
        setError("Nie udało się zapisać opisu.");
      } finally {
        setSaving(false);
      }
    });
  };
  const cancel = () => {
    setDraft(initial);
    setEditorKey((k) => k + 1);
    setEditing(hasRealContent(initial) ? false : canEdit);
  };

  return (
    <section className="flex flex-col gap-1.5" data-ui="task-description">
      <span className="eyebrow">Opis</span>
      {editing ? (
        <div
          className="flex flex-col gap-2"
          onBlur={(e) => {
            // Autosave when focus leaves the whole editor block (toolbar clicks stay inside).
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            if (dirty && !saving) save();
          }}
        >
          <RichTextEditor key={editorKey} initial={draft} readOnly={false} autoFocus onChange={(doc) => setDraft(doc)} placeholder="Dodaj opis…" />
          {error && <span className="text-xs text-danger-text">{error}</span>}
          {dirty && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={cancel} disabled={saving}>Anuluj</Button>
              <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={save} loading={saving}>Zapisz</Button>
            </div>
          )}
        </div>
      ) : hasRealContent(draft) ? (
        <div
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          aria-label={canEdit ? "Edytuj opis" : undefined}
          onClick={() => canEdit && setEditing(true)}
          onKeyDown={(e) => { if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setEditing(true); } }}
          className={canEdit ? "-mx-1 rounded-sm px-1 outline-none hover:bg-n-50" : undefined}
        >
          <RichTextEditor key={`view-${editorKey}`} initial={draft} readOnly variant="display" />
        </div>
      ) : (
        <p className="text-sm text-fg-3">{canEdit ? "Brak opisu." : "Brak opisu."}</p>
      )}
    </section>
  );
}

// ProseMirror's empty doc is `{type:'doc',content:[{type:'paragraph'}]}` — look for any text node.
function hasRealContent(doc: RichTextDoc | null): boolean {
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string" && n.text.length > 0) return true;
    return Array.isArray(n.content) && n.content.some(walk);
  };
  return walk(doc);
}
