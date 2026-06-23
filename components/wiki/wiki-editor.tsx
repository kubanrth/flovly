"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronLeft } from "lucide-react";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { updateWikiPageAction } from "@/app/(app)/w/[workspaceId]/wiki/actions";

export function WikiEditor({
  workspaceId,
  initial,
  canEdit,
}: {
  workspaceId: string;
  initial: { title: string; contentJson: RichTextDoc | null };
  canEdit: boolean;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updateWikiPageAction(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 1400);
        })
      }
      // Mobile v4 (B11 — Wiki): pb-24 reserves space for sticky save bar; desktop unchanged.
      className="flex flex-col gap-6 pb-24 md:pb-0"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />

      {/* Mobile-only back chevron + workspace anchor. Sticky so user can always retreat. */}
      <Link
        href={`/w/${workspaceId}`}
        className="flex min-h-11 items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        <ChevronLeft size={14} /> workspace
      </Link>

      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          <BookOpen size={16} />
        </span>
        <input
          name="title"
          required
          defaultValue={initial.title}
          readOnly={!canEdit}
          maxLength={120}
          // Mobile v4: title 18px display per spec — readable but not overwhelming on 320px viewports.
          className="flex-1 border-b border-border bg-transparent pb-2 font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 md:text-[2.2rem] md:leading-[1.1] md:tracking-[-0.03em]"
        />
      </div>

      <RichTextEditor
        name="contentJson"
        initial={initial.contentJson}
        readOnly={!canEdit}
        placeholder="Opisz projekt: cel, kluczowe osoby, decyzje, linki, cokolwiek."
      />

      {canEdit && (
        <>
          {/* Desktop save bar — inline. */}
          <div className="hidden items-center gap-4 md:flex">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Zapisz wiki
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
                <Check size={12} /> zapisano
              </span>
            )}
          </div>

          {/* Mobile sticky save bar — sits above safe-area-inset-bottom. */}
          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-brand-gradient px-5 text-[0.95rem] font-semibold text-white shadow-brand"
              >
                Zapisz wiki
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-primary">
                  <Check size={12} /> zapisano
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </form>
  );
}
