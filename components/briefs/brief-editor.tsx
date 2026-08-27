"use client";

// E8 — edytor pojedynczego pomysłu. Nagłówek z emoji, kolorem, statusem
// i tytułem; treść w Tiptapie (tabele, obrazy); autosave co 500 ms, stan
// zapisu w stopce („Zapisano · hh:mm").

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteBriefAction,
  requestBriefImageUploadAction,
  updateBriefAction,
} from "@/app/(app)/w/[workspaceId]/briefs/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { STATUS_LABEL, type BriefStatus } from "@/components/briefs/brief-segments";
import { Button } from "@/components/ui/button";
import { IconChevronLeft, IconTrash } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { HEADER_PALETTE } from "@/lib/colors";

const EMOJI_PICKS = ["📝", "🎯", "🚀", "💡", "🎨", "📊", "🔥", "✨", "🛠", "📦"];
const STATUS_ITEMS = (Object.keys(STATUS_LABEL) as BriefStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

export function BriefEditor({
  brief,
  canEdit,
}: {
  brief: {
    id: string;
    workspaceId: string;
    title: string;
    contentJson: RichTextDoc | null;
    status: BriefStatus;
    emoji: string | null;
    headerColor: string;
    creatorName: string;
    updatedAt: string;
  };
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(brief.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(brief.contentJson);
  const [status, setStatus] = useState<BriefStatus>(brief.status);
  const [emoji, setEmoji] = useState<string | null>(brief.emoji);
  const [headerColor, setHeaderColor] = useState(brief.headerColor);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Autosave: tytuł + treść + emoji + kolor + status.
  useEffect(() => {
    if (!canEdit) return;
    const docStr = doc ? JSON.stringify(doc) : "";
    const initialDocStr = brief.contentJson ? JSON.stringify(brief.contentJson) : "";
    const hasChanges =
      title !== brief.title ||
      docStr !== initialDocStr ||
      status !== brief.status ||
      emoji !== brief.emoji ||
      headerColor !== brief.headerColor;
    if (!hasChanges) return;

    const saveNow = () => {
      const fd = new FormData();
      fd.set("id", brief.id);
      fd.set("title", title);
      if (doc) fd.set("contentJson", JSON.stringify(doc));
      fd.set("status", status);
      if (emoji !== null) fd.set("emoji", emoji);
      fd.set("headerColor", headerColor);
      startTransition(async () => {
        await updateBriefAction(fd);
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      });
    };

    const h = setTimeout(saveNow, 500);
    // Odmontowanie z niezapisaną zmianą — dopychamy zapis natychmiast.
    return () => {
      clearTimeout(h);
      if (hasChanges) saveNow();
    };
  }, [
    title, doc, status, emoji, headerColor,
    brief.id, brief.title, brief.contentJson, brief.status, brief.emoji, brief.headerColor,
    canEdit,
  ]);

  return (
    <div
      data-ui="brief-editor"
      className="flex min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      {/* Kolor pomysłu jako pasek nagłówka — wartość z bazy, nie token. */}
      <div className="h-[3px] shrink-0" style={{ background: headerColor }} aria-hidden />

      <header className="flex shrink-0 flex-col gap-2 border-b border-border px-8 pt-3 pb-3 max-md:px-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${brief.workspaceId}/briefs`}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            <IconChevronLeft width={13} height={13} /> Creative Board
          </Link>
          <span className="flex-1" />
          {canEdit && (
            <>
              <Popover>
                <PopoverTrigger
                  aria-label="Kolor pomysłu"
                  className="grid size-8 place-items-center rounded-md border border-input-border outline-none hover:border-input-border-hover active:bg-n-100"
                >
                  <span className="size-4 rounded-full" style={{ background: headerColor }} aria-hidden />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {HEADER_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setHeaderColor(c)}
                        aria-label={`Kolor ${c}`}
                        aria-pressed={c === headerColor}
                        className="grid size-8 place-items-center rounded-md outline-none hover:bg-n-100 active:bg-n-200"
                      >
                        <span className="size-5 rounded-full" style={{ background: c }} />
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Select
                items={STATUS_ITEMS}
                value={status}
                onValueChange={(v) => setStatus(v as BriefStatus)}
                aria-label="Status pomysłu"
                className="w-[160px]"
              />

              <form
                action={(fd) => {
                  if (!confirm("Usunąć ten pomysł?")) return;
                  startTransition(async () => {
                    await deleteBriefAction(fd);
                  });
                }}
                className="m-0"
              >
                <input type="hidden" name="id" value={brief.id} />
                <Button type="submit" variant="ghost" iconOnly aria-label="Usuń pomysł" className="hover:text-danger-text">
                  <IconTrash width={14} height={14} />
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Popover>
            <PopoverTrigger
              aria-label="Wybierz emoji"
              disabled={!canEdit}
              className="grid size-9 shrink-0 place-items-center rounded-md border border-input-border text-lg outline-none hover:border-input-border-hover active:bg-n-100 disabled:border-n-200 disabled:text-n-400"
            >
              {emoji ?? "＋"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {EMOJI_PICKS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    aria-label={`Emoji ${e}`}
                    className="grid size-8 place-items-center rounded-md text-base outline-none hover:bg-n-100 active:bg-n-200"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEmoji(null)}
                className="mt-1 h-7 w-full rounded-md text-xs text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
              >
                Bez emoji
              </button>
            </PopoverContent>
          </Popover>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nazwa pomysłu…"
            maxLength={200}
            readOnly={!canEdit}
            aria-label="Nazwa pomysłu"
            className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold tracking-[-0.3px] outline-none placeholder:text-n-400"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5 max-md:px-4">
        <div className="mx-auto max-w-[760px]">
          <RichTextEditor
            initial={doc}
            readOnly={!canEdit}
            variant={canEdit ? "field" : "display"}
            extras="brief"
            placeholder="Zacznij pisać pomysł…"
            onChange={(d) => setDoc(d)}
            onImageUpload={async (file) => {
              const res = await requestBriefImageUploadAction(brief.id, file.name, file.type, file.size);
              if (!res.ok) {
                alert(res.error);
                return null;
              }
              try {
                const putRes = await fetch(res.uploadUrl, {
                  method: "PUT",
                  headers: { "Content-Type": file.type },
                  body: file,
                });
                if (!putRes.ok) {
                  alert("Upload nie powiódł się.");
                  return null;
                }
              } catch (err) {
                console.warn("[brief-image] upload error", err);
                alert("Upload nie powiódł się — sprawdź połączenie.");
                return null;
              }
              return res.publicSrc;
            }}
          />
        </div>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-1.5 border-t border-border bg-canvas px-8 font-mono text-2xs text-fg-2 max-md:px-4">
        <span>{brief.creatorName}</span>
        <span aria-hidden>·</span>
        <span>zmieniony {new Date(brief.updatedAt).toLocaleDateString("pl-PL")}</span>
        <span className="ml-auto">
          {canEdit ? (savedAt ? `Zapisano · ${savedAt}` : "Autozapis włączony") : "Tylko do odczytu"}
        </span>
      </footer>
    </div>
  );
}
