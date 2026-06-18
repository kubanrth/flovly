"use client";

import { startTransition, useEffect, useState } from "react";
import { FileText, Check } from "lucide-react";
import {
  RichTextEditor,
  type RichTextDoc,
} from "@/components/task/rich-text-editor";
import { updateBoardOverviewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/overview/actions";

// Editor 'Opis ogólny' — Tiptap rich-text z autosave (500ms debounce).
// Klient pisze, save w tle, indicator "zapisano" obok tytułu.
export function BoardOverviewEditor({
  workspaceId,
  boardId,
  initial,
  canEdit,
}: {
  workspaceId: string;
  boardId: string;
  initial: RichTextDoc | null;
  canEdit: boolean;
}) {
  const [doc, setDoc] = useState<RichTextDoc | null>(initial);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    const docStr = doc ? JSON.stringify(doc) : "";
    const initialStr = initial ? JSON.stringify(initial) : "";
    if (docStr === initialStr) return;
    const h = setTimeout(() => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("boardId", boardId);
      fd.set("contentJson", docStr || JSON.stringify({ type: "doc", content: [] }));
      startTransition(async () => {
        await updateBoardOverviewAction(fd);
        setSavedAt(
          new Date().toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      });
    }, 500);
    return () => clearTimeout(h);
  }, [doc, initial, workspaceId, boardId, canEdit]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(46,19,52,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <h3 className="font-display text-[1.15rem] font-bold tracking-[-0.02em]">
            Opis ogólny
          </h3>
        </div>
        {savedAt && canEdit && (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-primary">
            <Check size={11} /> zapisano {savedAt}
          </span>
        )}
        {!canEdit && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            tylko do odczytu
          </span>
        )}
      </div>

      <div className="min-h-[300px]">
        <RichTextEditor
          initial={doc}
          readOnly={!canEdit}
          placeholder="Opisz cel tablicy, ważne zasady, brand guidelines, ToDo… To miejsce widzą wszyscy członkowie."
          variant={canEdit ? "field" : "display"}
          extras="brief"
          onChange={(d) => setDoc(d)}
        />
      </div>
    </section>
  );
}
