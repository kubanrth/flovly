"use client";

// B11 „Opis” — dokument tablicy. Full-bleed Tiptap page: 28px toolbar on top,
// 760px content column, „Zapisano · hh:mm” status, footer with the word count.
// Autosave (500 ms debounce) goes through the existing `updateBoardOverviewAction`.

import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronDown, IconExternal, IconImage, IconList, IconListNumbered, IconTable, IconTodo } from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import type { RichTextDoc } from "@/components/task/rich-text-editor";
import { updateBoardOverviewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/overview/actions";

const PLACEHOLDER = "Wpisz „/” aby wstawić blok…";

const BLOCKS = [
  { label: "Akapit", isActive: (e: Editor) => e.isActive("paragraph"), run: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: "Nagłówek", isActive: (e: Editor) => e.isActive("heading", { level: 2 }), run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Podnagłówek", isActive: (e: Editor) => e.isActive("heading", { level: 3 }), run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Cytat", isActive: (e: Editor) => e.isActive("blockquote"), run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
];

function countWords(doc: RichTextDoc | null): number {
  if (!doc) return 0;
  let text = "";
  const walk = (node: { type?: string; text?: string; content?: unknown[] }) => {
    if (typeof node.text === "string") text += ` ${node.text}`;
    if (Array.isArray(node.content)) for (const child of node.content) walk(child as { content?: unknown[] });
  };
  walk(doc as { content?: unknown[] });
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function BoardOverviewEditor({
  workspaceId,
  boardId,
  initial,
  canEdit,
  lastChange,
}: {
  workspaceId: string;
  boardId: string;
  initial: RichTextDoc | null;
  canEdit: boolean;
  /** Last „board.overview.updated” audit entry, when there is one. */
  lastChange?: { name: string; avatarUrl: string | null; label: string; time: string } | null;
}) {
  const [doc, setDoc] = useState<RichTextDoc | null>(initial);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already brings Bold/Italic/Underline/Strike/Link/lists.
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { class: "doc-link" } },
      }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "doc-image" } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "doc-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: (initial as JSONContent | null) ?? undefined,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "doc-content focus:outline-none" } },
    onUpdate: ({ editor }) => setDoc(editor.getJSON() as RichTextDoc),
  });

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

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
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      });
    }, 500);
    return () => clearTimeout(h);
  }, [doc, initial, workspaceId, boardId, canEdit]);

  const words = useMemo(() => countWords(doc), [doc]);
  const saveLabel = savedAt ?? lastChange?.time ?? null;

  return (
    <div data-ui="board-doc" className="-mx-6 -my-4 flex flex-1 flex-col max-md:-mx-4">
      <div className="no-scrollbar flex min-h-10 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-6 py-1.5 max-md:px-4">
        {canEdit && editor && <Toolbar editor={editor} />}
        <span className="flex-1" />
        <span className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-n-500">
          {canEdit ? (
            saveLabel ? (
              <>
                <span className="size-[7px] rounded-full bg-success" aria-hidden />
                Zapisano · {saveLabel}
              </>
            ) : (
              "Autozapis włączony"
            )
          ) : (
            "Tylko do odczytu"
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* The column stretches so a click below the last paragraph still lands
            in the document instead of on dead space. */}
        <div className="mx-auto flex h-full max-w-[760px] flex-col px-10 pb-15 pt-8 max-md:px-4 max-md:pt-6">
          {lastChange && (
            <div className="mb-6 flex items-center gap-2">
              <Avatar name={lastChange.name} src={lastChange.avatarUrl} size={20} />
              <span className="text-xs text-n-500">{lastChange.name} · ostatnia zmiana {lastChange.label}</span>
            </div>
          )}
          <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col [&>.ProseMirror]:min-h-full [&>.ProseMirror]:flex-1" />
        </div>
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-muted-foreground max-md:px-4">
        dokument tablicy · {words.toLocaleString("pl-PL")} {plPlural(words, "słowo", "słowa", "słów")}
      </footer>

      <style>{`
        .doc-content { font-size: 13px; line-height: 21px; color: var(--fg); }
        .doc-content > * + * { margin-top: 16px; }
        .doc-content h2 { font-size: 16px; line-height: 22px; font-weight: 600; margin-top: 24px; }
        .doc-content h3 { font-size: 14px; line-height: 20px; font-weight: 600; margin-top: 20px; }
        .doc-content h2 + *, .doc-content h3 + * { margin-top: 8px; }
        .doc-content ul, .doc-content ol { padding-left: 20px; }
        .doc-content ul { list-style: disc; }
        .doc-content ol { list-style: decimal; }
        .doc-content li + li { margin-top: 4px; }
        .doc-content li > p { margin: 0; }
        .doc-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .doc-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
        .doc-content ul[data-type="taskList"] li > label { display: inline-flex; margin-top: 3px; }
        .doc-content ul[data-type="taskList"] input[type="checkbox"] {
          appearance: none; width: 14px; height: 14px; border-radius: 4px;
          border: 1.5px solid var(--input-border-hover); background: var(--card); cursor: pointer;
        }
        .doc-content ul[data-type="taskList"] input[type="checkbox"]:checked {
          background: var(--control-on) center/9px no-repeat
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.8 5.4l2.2 2.2 4.2-4.8' fill='none' stroke='%23fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          border-color: var(--control-on);
        }
        .doc-content blockquote { border-left: 2px solid var(--border); padding-left: 12px; color: var(--fg-2); }
        .doc-content code { background: var(--n-100); border-radius: 4px; padding: 0 4px; font-family: var(--font-mono); font-size: 12px; }
        .doc-content pre { background: var(--n-100); border-radius: 8px; padding: 12px 14px; font-family: var(--font-mono); font-size: 12px; line-height: 20px; overflow-x: auto; }
        .doc-content pre code { background: transparent; padding: 0; }
        .doc-content hr { border: 0; border-top: 1px solid var(--border); }
        .doc-content .doc-link { color: var(--link); text-decoration: none; }
        .doc-content .doc-link:hover { text-decoration: underline; }
        .doc-content .doc-image { display: block; max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 8px; }
        .doc-content .doc-table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        .doc-content .doc-table td, .doc-content .doc-table th { border: 1px solid var(--border); padding: 6px 10px; vertical-align: top; min-width: 80px; }
        .doc-content .doc-table th { background: var(--canvas); font-weight: 600; text-align: left; }
        .doc-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: var(--n-400); float: left; height: 0; pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const block = BLOCKS.find((b) => b.isActive(editor)) ?? BLOCKS[0]!;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adres linku:", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // ponytail: obraz wstawiany z adresu — board doc nie ma akcji uploadu
  // (brief ma własną: `requestBriefImageUploadAction`).
  const setImage = () => {
    const url = window.prompt("Adres obrazka:", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <>
      <Menu>
        <MenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm bg-n-100 px-2 text-xs font-medium text-n-700 outline-none hover:bg-n-200 active:bg-n-300">
          {block.label}
          <IconChevronDown width={10} height={10} strokeWidth={1.8} />
        </MenuTrigger>
        <MenuContent className="min-w-[180px]">
          {BLOCKS.map((b) => (
            <MenuItem key={b.label} onClick={() => b.run(editor)}>
              {b.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Sep />
      <TBtn label="Pogrubienie" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="text-sm font-bold">B</span>
      </TBtn>
      <TBtn label="Kursywa" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="text-sm italic">I</span>
      </TBtn>
      <TBtn label="Podkreślenie" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="text-sm underline">U</span>
      </TBtn>
      <TBtn label="Przekreślenie" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="text-sm line-through">S</span>
      </TBtn>

      <Sep />
      <TBtn label="Lista punktowana" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IconList width={14} height={14} />
      </TBtn>
      <TBtn label="Lista numerowana" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IconListNumbered width={14} height={14} />
      </TBtn>
      <TBtn label="Lista zadań" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <IconTodo width={14} height={14} />
      </TBtn>

      <Sep />
      <TBtn label="Link" active={editor.isActive("link")} onClick={setLink}>
        <IconExternal width={14} height={14} />
      </TBtn>
      <TBtn label="Blok kodu" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <span className="font-mono text-2xs">&lt;/&gt;</span>
      </TBtn>
      <TBtn label="Obraz" active={false} onClick={setImage}>
        <IconImage width={14} height={14} />
      </TBtn>
      <TBtn
        label="Tabela"
        active={editor.isActive("table")}
        onClick={() =>
          editor.isActive("table")
            ? editor.chain().focus().deleteTable().run()
            : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <IconTable width={14} height={14} />
      </TBtn>
    </>
  );
}

const Sep = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;

function TBtn({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none",
        "hover:bg-n-100 hover:text-foreground active:bg-n-200",
        "aria-pressed:bg-n-100 aria-pressed:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
