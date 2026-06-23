"use client";

// Template picker. Klient wskazał ClickUp Design Brief Templates
// page (11 template'ów) jako wzór — zamiast jednego stub'a teraz przy
// "Nowy board" otwiera się modal z gridem template'ów do wyboru.

import { startTransition, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createBriefAction } from "@/app/(app)/w/[workspaceId]/briefs/actions";
import { BRIEF_TEMPLATES } from "@/lib/brief-templates";

export function NewBriefForm({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>(BRIEF_TEMPLATES[0].id);
  const [title, setTitle] = useState("");

  // Reset modal state on close.
  useEffect(() => {
    if (!open) {
      setTitle("");
      setTemplateId(BRIEF_TEMPLATES[0].id);
    }
  }, [open]);

  // Escape-to-close while modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("title", title.trim());
    fd.set("templateId", templateId);
    startTransition(async () => {
      await createBriefAction(fd);
      // createBriefAction redirectuje do nowego briefu — modal zamknie
      // się automatycznie wraz z nawigacją.
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand-gradient px-4 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
      >
        <Plus size={14} /> Nowy board
      </button>

      {open && (
        <div
          // z-[100] === Z.modalBackdrop (F12-K104).
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 px-4 py-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.4)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
              <div>
                <span className="eyebrow">Creative Board</span>
                <h2 className="mt-1 font-display text-[1.5rem] font-bold leading-tight tracking-[-0.02em]">
                  Wybierz template
                </h2>
                <p className="mt-1 text-[0.86rem] text-muted-foreground">
                  Każdy template to gotowy szkielet z tabelami i sekcjami — zaczynasz od ustrukturyzowanej zawartości zamiast pustego dokumentu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Template grid */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BRIEF_TEMPLATES.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      data-active={active}
                      className="group/card flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-[transform,border-color,box-shadow] hover:-translate-y-[1px] hover:border-primary/60 data-[active=true]:border-primary data-[active=true]:shadow-[0_0_0_2px_var(--primary)]"
                      style={
                        active
                          ? {
                              boxShadow: `0 0 0 2px ${t.color}`,
                              borderColor: t.color,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[1.1rem]"
                          style={{ background: `${t.color}1A`, color: t.color }}
                        >
                          {t.emoji}
                        </span>
                        <span className="min-w-0 flex-1 font-display text-[0.96rem] font-semibold leading-tight tracking-[-0.01em]">
                          {t.name}
                        </span>
                        {active && (
                          <span
                            className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: t.color }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[0.8rem] leading-[1.45] text-muted-foreground">
                        {t.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer with title input + create button */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/40 px-6 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Nazwa
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) submit();
                  }}
                  autoFocus
                  required
                  maxLength={200}
                  placeholder="np. Kampania Q3 — Awareness"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[0.92rem] outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!title.trim()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
              >
                Utwórz board
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
