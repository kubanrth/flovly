"use client";

import { startTransition, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import {
  createBoardLinkAction,
  deleteBoardLinkAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/board-link-actions";
import type { BoardLinkKind } from "@/lib/generated/prisma/enums";

export interface BoardLinkRow {
  id: string;
  url: string;
  label: string | null;
  kind: BoardLinkKind;
}

// Brand-accurate-ish glyphs. These are tiny decorative SVGs; for the real
// Google logos add files in /public/integrations/ and swap <LinkIcon /> for
// next/image refs there.
const KIND_VISUAL: Record<
  BoardLinkKind,
  { label: string; color: string; bg: string; icon: string }
> = {
  DRIVE: { label: "Drive", color: "#1A73E8", bg: "#E8F0FE", icon: "▲" },
  SHEETS: { label: "Sheets", color: "#188038", bg: "#E6F4EA", icon: "▦" },
  DOCS: { label: "Docs", color: "#1967D2", bg: "#E8F0FE", icon: "▤" },
  SLIDES: { label: "Slides", color: "#F29900", bg: "#FEF7E0", icon: "▥" },
  OTHER: { label: "Link", color: "#475569", bg: "#F1F5F9", icon: "↗" },
};

export function BoardLinks({
  workspaceId,
  boardId,
  links,
  canManage,
}: {
  workspaceId: string;
  boardId: string;
  links: BoardLinkRow[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);

  if (links.length === 0 && !canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const v = KIND_VISUAL[link.kind];
        const host = (() => {
          try {
            return new URL(link.url).hostname.replace(/^www\./, "");
          } catch {
            return link.url;
          }
        })();
        return (
          <div key={link.id} className="group relative">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 pr-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.1em] transition-[transform,border-color,box-shadow] hover:-translate-y-[1px] hover:border-primary/50 hover:shadow-[0_6px_16px_-8px_rgba(10,10,40,0.2)]"
              style={{ color: v.color }}
            >
              <span
                className="grid h-5 w-5 place-items-center rounded-sm font-display text-[0.75rem]"
                style={{ background: v.bg, color: v.color }}
                aria-hidden
              >
                {v.icon}
              </span>
              <span>{link.label ?? v.label}</span>
              <span className="text-muted-foreground/60 normal-case tracking-normal">
                {host}
              </span>
              <ExternalLink size={10} className="opacity-50" />
            </a>
            {canManage && (
              <form
                action={(fd) => startTransition(() => deleteBoardLinkAction(fd))}
                className="m-0 absolute -right-1.5 -top-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              >
                <input type="hidden" name="id" value={link.id} />
                <button
                  type="submit"
                  aria-label="Usuń link"
                  className="grid h-4 w-4 place-items-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:text-destructive"
                >
                  <X size={10} />
                </button>
              </form>
            )}
          </div>
        );
      })}

      {canManage && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <Plus size={11} /> Dodaj link
        </button>
      )}

      {canManage && adding && (
        <form
          action={(fd) =>
            startTransition(async () => {
              try {
                await createBoardLinkAction(fd);
                setAdding(false);
              } catch (err) {
                console.error("Create board link failed:", err);
                setAdding(false);
              }
            })
          }
          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-2 py-1"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="boardId" value={boardId} />
          <input
            type="url"
            name="url"
            required
            autoFocus
            placeholder="https://docs.google.com/…"
            className="w-[280px] bg-transparent px-2 py-0.5 text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <input
            type="text"
            name="label"
            placeholder="Etykieta (opcj.)"
            className="w-[120px] bg-transparent px-2 py-0.5 text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            className="grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-white shadow-brand transition-opacity hover:opacity-90"
            aria-label="Zapisz link"
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            aria-label="Anuluj"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X size={12} />
          </button>
        </form>
      )}
    </div>
  );
}
