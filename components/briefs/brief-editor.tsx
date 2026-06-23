"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Smile, Trash2 } from "lucide-react";
import {
  deleteBriefAction,
  requestBriefImageUploadAction,
  updateBriefAction,
} from "@/app/(app)/w/[workspaceId]/briefs/actions";
import {
  RichTextEditor,
  type RichTextDoc,
} from "@/components/task/rich-text-editor";
import { PortalDropdown } from "@/components/ui/portal-dropdown";

type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Szkic",
  IN_REVIEW: "W recenzji",
  APPROVED: "Zatwierdzony",
  ARCHIVED: "Zarchiwizowany",
};
const STATUS_COLOR: Record<Status, string> = {
  DRAFT: "#64748B",
  IN_REVIEW: "#F59E0B",
  APPROVED: "#10B981",
  ARCHIVED: "#94A3B8",
};

// Paleta z `lib/colors.ts` (BRAND_PALETTE).
import { HEADER_PALETTE as HEADER_COLORS } from "@/lib/colors";

const EMOJI_PICKS = ["📝", "🎯", "🚀", "💡", "🎨", "📊", "🔥", "✨", "🛠", "📦"];

export function BriefEditor({
  brief,
  canEdit,
}: {
  brief: {
    id: string;
    workspaceId: string;
    title: string;
    contentJson: RichTextDoc | null;
    status: Status;
    emoji: string | null;
    headerColor: string;
    creatorName: string;
    updatedAt: string;
  };
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(brief.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(brief.contentJson);
  const [status, setStatus] = useState<Status>(brief.status);
  const [emoji, setEmoji] = useState<string | null>(brief.emoji);
  const [headerColor, setHeaderColor] = useState<string>(brief.headerColor);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  // Autosave debounced — title + doc + emoji + headerColor + status.
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
        setSavedAt(
          new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
        );
      });
    };

    const h = setTimeout(saveNow, 500);

    // FIX: flush pending autosave on unmount by calling immediately
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
    <div className="flex flex-col">
      <header
        className="flex flex-col gap-3 border-b border-border px-8 py-8"
        style={{
          background: `linear-gradient(180deg, ${headerColor}22 0%, transparent 100%)`,
          borderTop: `4px solid ${headerColor}`,
        }}
      >
        <div className="flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          <Link
            href={`/w/${brief.workspaceId}/briefs`}
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} /> creative board
          </Link>
          {savedAt && canEdit && (
            <span className="text-primary">· zapisano {savedAt}</span>
          )}
          {!canEdit && <span>· tylko do odczytu</span>}
        </div>

        <div className="flex items-start gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => canEdit && setEmojiOpen((o) => !o)}
              aria-label="Wybierz emoji"
              disabled={!canEdit}
              className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-card text-[1.6rem] transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emoji ?? <Smile size={20} className="text-muted-foreground" />}
            </button>
            {emojiOpen && canEdit && (
              <>
                <button
                  type="button"
                  aria-label="Zamknij"
                  onClick={() => setEmojiOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 grid grid-cols-5 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md">
                  {EMOJI_PICKS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setEmoji(e);
                        setEmojiOpen(false);
                      }}
                      className="grid h-8 w-8 place-items-center rounded text-[1.2rem] hover:bg-accent"
                    >
                      {e}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEmoji(null);
                      setEmojiOpen(false);
                    }}
                    className="col-span-5 mt-1 rounded px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:bg-accent"
                  >
                    bez emoji
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nazwa briefu…"
            maxLength={200}
            readOnly={!canEdit}
            aria-label="Nazwa briefu"
            className="flex-1 border-0 bg-transparent font-display text-[2.2rem] font-bold leading-tight tracking-[-0.02em] outline-none placeholder:text-muted-foreground/40"
          />

          {canEdit && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Header color picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColorOpen((o) => !o)}
                  aria-label="Kolor nagłówka"
                  title="Kolor nagłówka"
                  className="grid h-8 w-8 place-items-center rounded-md border border-border transition-transform hover:scale-105"
                >
                  <span
                    className="block h-4 w-4 rounded-full ring-1 ring-foreground/10"
                    style={{ background: headerColor }}
                  />
                </button>
                {colorOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Zamknij"
                      onClick={() => setColorOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute right-0 top-[calc(100%+4px)] z-50 grid grid-cols-4 gap-1.5 rounded-lg border border-border bg-popover p-2 shadow-md">
                      {HEADER_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setHeaderColor(c);
                            setColorOpen(false);
                          }}
                          aria-label={`Kolor ${c}`}
                          className="h-6 w-6 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <PortalDropdown<Status>
                ariaLabel="Status briefu"
                width={200}
                value={status}
                onChange={(v) => setStatus(v)}
                options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({
                  value: s,
                  label: STATUS_LABEL[s],
                  prefix: (
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-foreground/10"
                      style={{ background: STATUS_COLOR[s] }}
                    />
                  ),
                }))}
                triggerClassName="inline-flex h-8 min-w-[160px] items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-[0.78rem] outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <form
                action={async (fd) => {
                  // FIX: move confirm() outside server action to avoid pending stuck state
                  if (!confirm("Usunąć ten brief?")) return;
                  startTransition(async () => {
                    await deleteBriefAction(fd);
                  });
                }}
                className="m-0"
              >
                <input type="hidden" name="id" value={brief.id} />
                <button
                  type="submit"
                  aria-label="Usuń"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          {brief.creatorName} · zmieniony {new Date(brief.updatedAt).toLocaleString("pl-PL")}
        </div>
      </header>

      <div className="px-8 py-6">
        <RichTextEditor
          initial={doc}
          readOnly={!canEdit}
          variant={canEdit ? "field" : "display"}
          extras="brief"
          placeholder="Zacznij pisać brief…"
          onChange={(d) => setDoc(d)}
          onImageUpload={async (file) => {
            const res = await requestBriefImageUploadAction(
              brief.id,
              file.name,
              file.type,
              file.size,
            );
            if (!res.ok) {
              alert(res.error);
              return null;
            }
            // Upload to signed URL via direct PUT.
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
  );
}
