"use client";

// E10 „Wiki" — baza wiedzy przestrzeni. Panel drzewa 280 px + kolumna
// treści 720 px + spis „Na tej stronie" liczony z nagłówków h2.
// Drzewo ma dokładnie jedną pozycję: schemat trzyma jedną `WikiPage` na
// przestrzeń (patrz docs/redesign/OMITTED.md — brak drzewa i wersji).

import { startTransition, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IconCopy, IconMore, IconPen, IconPlus, IconWiki } from "@/components/ui/icons";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { updateWikiPageAction } from "@/app/(app)/w/[workspaceId]/wiki/actions";
import { readingMinutes, slugify } from "./headings";

export function WikiPage({
  workspaceId,
  workspaceName,
  page,
  canEdit,
}: {
  workspaceId: string;
  workspaceName: string;
  page: {
    title: string;
    contentJson: RichTextDoc | null;
    /** Autor ostatniej zmiany — może być pusty na starych wpisach. */
    editorName: string | null;
    editorAvatar: string | null;
    /** Preformatowane na serwerze („22 sie 2026"). */
    updatedLabel: string;
  };
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [doc, setDoc] = useState<RichTextDoc | null>(page.contentJson);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const minutes = readingMinutes(doc);
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]);

  // The table of contents is read off the rendered DOM, not off the stored
  // doc. Two reasons the doc-based version was wrong: Tiptap renders a stored
  // level-1 heading as <h2> while `extractHeadings(doc, 2)` skips it (so the
  // list was short and the index→node mapping slid by one), and Tiptap mounts
  // its nodes outside React's render, so an effect keyed on the doc ran before
  // the headings existed and never assigned a single id — every anchor was dead.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const sync = () => {
      const seen = new Map<string, number>();
      const next = [...root.querySelectorAll<HTMLElement>(".tiptap-content h2")].map((el, i) => {
        const text = el.textContent?.trim() ?? "";
        const base = slugify(text, `sekcja-${i + 1}`);
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        const id = n === 1 ? base : `${base}-${n}`;
        el.setAttribute("id", id);
        return { id, text };
      });
      setHeadings((prev) =>
        prev.length === next.length && prev.every((h, i) => h.id === next[i]!.id && h.text === next[i]!.text)
          ? prev
          : next,
      );
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [editing]);

  const jumpTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const save = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("title", title.trim() || page.title);
    fd.set("contentJson", JSON.stringify(doc ?? { type: "doc", content: [] }));
    setSaving(true);
    startTransition(async () => {
      await updateWikiPageAction(fd);
      setSaving(false);
      setEditing(false);
      setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
    });
  };

  const cancel = () => {
    setTitle(page.title);
    setDoc(page.contentJson);
    setEditing(false);
  };

  return (
    <div data-ui="wiki" className="flex min-h-0 min-w-0 flex-1">
      <aside
        data-ui="wiki-tree"
        className="flex w-[280px] shrink-0 flex-col border-r border-border bg-canvas max-md:hidden"
      >
        <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5 pb-2.5">
          <span className="flex-1 text-md font-semibold">Wiki</span>
          <Button
            size="md"
            iconOnly
            disabled
            aria-label="Nowa strona"
            title="Nowa strona — drzewo stron czeka na backend"
          >
            <IconPlus width={14} height={14} />
          </Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <a
            href="#tresc"
            aria-current="page"
            className="flex h-[30px] items-center gap-1.5 rounded-md bg-selected px-2 text-sm font-medium text-foreground no-underline shadow-[inset_2px_0_0_var(--orange-500)] outline-none hover:bg-selected active:bg-selected"
          >
            <IconWiki width={13} height={13} className="shrink-0 text-orange-700" />
            <span className="min-w-0 flex-1 truncate">{page.title}</span>
          </a>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3 max-md:px-4">
          <span className="truncate text-xs text-fg-2">{workspaceName} /</span>
          <span className="flex-1" />
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-fg-3">
            <span
              className={cn("size-[7px] rounded-full", saving ? "bg-warning" : "bg-success")}
              aria-hidden
            />
            {saving ? "Zapisuję…" : savedAt ? `Zapisano · ${savedAt}` : "Zapisano"}
          </span>
          {canEdit &&
            (editing ? (
              <>
                <Button variant="secondary" size="sm" onClick={cancel} disabled={saving}>
                  Anuluj
                </Button>
                <Button size="sm" onClick={save} loading={saving} disabled={saving}>
                  Zapisz
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <IconPen width={12} height={12} />
                Edytuj
              </Button>
            ))}
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="sm" iconOnly aria-label="Więcej opcji" />}
            >
              <IconMore width={15} height={15} />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                icon={<IconCopy />}
                onClick={() => void navigator.clipboard?.writeText(window.location.href)}
              >
                Kopiuj link do strony
              </MenuItem>
            </MenuContent>
          </Menu>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto" ref={contentRef}>
          <div id="tresc" className="mx-auto max-w-[720px] px-10 pt-7 pb-15 max-md:px-4 max-md:pt-5">
            {editing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                aria-label="Tytuł strony"
                className="mb-1 h-9 text-xl font-semibold tracking-[-0.3px]"
              />
            ) : (
              <h1 className="mb-1 text-xl leading-[30px] font-semibold tracking-[-0.3px]">
                {page.title}
              </h1>
            )}

            <div className="mb-5 flex items-center gap-2">
              {page.editorName && (
                <Avatar name={page.editorName} src={page.editorAvatar} size={20} />
              )}
              <span className="text-xs text-fg-3">
                {page.editorName ? `${page.editorName} · ` : ""}
                aktualizacja {page.updatedLabel} · czyta się {minutes} min
              </span>
            </div>

            {headings.length > 0 && !editing && (
              <nav
                data-ui="wiki-toc"
                aria-label="Na tej stronie"
                className="mb-5 rounded-lg border border-border bg-canvas px-3.5 py-3"
              >
                <p className="eyebrow mb-1.5">Na tej stronie</p>
                <div className="flex flex-col gap-[3px]">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        jumpTo(h.id);
                      }}
                      className="inline-flex min-h-6 w-fit items-center rounded-sm text-sm text-link no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900"
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              </nav>
            )}

            <div className="[&_.tiptap-content]:leading-[21px]">
              {/* `key` przełącza tryb, więc po zapisie widok czytania montuje
                  się od nowa z aktualnym `doc` — bez czekania na revalidate. */}
              <RichTextEditor
                key={editing ? "edit" : "read"}
                initial={doc}
                readOnly={!editing}
                variant={editing ? "field" : "display"}
                autoFocus={editing}
                placeholder="Opisz proces: kiedy, kto, checklista, co robimy gdy się wywali."
                onChange={editing ? setDoc : undefined}
              />
            </div>
          </div>
        </div>

        <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-muted-foreground max-md:px-4">
          Wiki · 1 strona · {headings.length}{" "}
          {plPlural(headings.length, "sekcja", "sekcje", "sekcji")}
        </footer>
      </div>
    </div>
  );
}
