"use client";

import { useEditor, EditorContent, ReactRenderer, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Mention } from "@tiptap/extension-mention";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { MentionList, type MentionListHandle, type MentionMember } from "@/components/task/mention-list";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  List,
  ListOrdered,
  Code2,
  Link as LinkIcon,
  Heading2,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
  Palette,
  Highlighter,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type RichTextDoc = { type: "doc"; content?: unknown[] };

export interface RichTextEditorProps {
  // ProseMirror JSON doc. `null` renders an empty editor.
  initial: RichTextDoc | null;
  readOnly: boolean;
  // Hidden-input name — emits the current JSON stringified so a normal
  // <form> submit picks it up. Omit for display-only renders.
  name?: string;
  placeholder?: string;
  // `display` strips toolbar + outer border so a read-only comment body
  // reads as flowing prose, not a form field.
  variant?: "field" | "display";
  // When provided, typing "@" opens an autocomplete of these members and
  // inserts a mention node. The Mention node is always registered in the
  // schema so display-variant editors can still render mention chips.
  mentionMembers?: MentionMember[];
  // Optional live feedback — invoked on every doc change so parent can
  // keep a local draft without posting a form submit.
  onChange?: (doc: RichTextDoc | null) => void;
  // Feature toggles for richer briefs. Display-variant editors
  // still render these nodes in read mode (Image/Table) but omit toolbar
  // buttons. Pass `extras="brief"` to enable the full toolbar set.
  extras?: "default" | "brief";
  // Optional async uploader — if set, the toolbar shows an "Insert image"
  // button. Implementation should upload a file and return the URL to
  // embed in the editor (the URL stays inside the contentJson).
  onImageUpload?: (file: File) => Promise<string | null>;
}

// Suggestion config with no matches — used when the editor has no members
// (display variant, or task description where mentions aren't populated).
// Keeps the default `char: "@"` so the Mention node schema is valid while
// ensuring the popover never opens.
const INERT_MENTION_SUGGESTION = {
  char: "@",
  items: () => [] as MentionMember[],
};

function buildMentionSuggestion(members: MentionMember[]) {
  return {
    char: "@",
    items: ({ query }: { query: string }) => {
      const q = query.trim().toLowerCase();
      const pool = q
        ? members.filter((m) => {
            const name = (m.name ?? "").toLowerCase();
            return name.includes(q) || m.email.toLowerCase().includes(q);
          })
        : members;
      return pool.slice(0, 8);
    },
    render: () => {
      let renderer: ReactRenderer<MentionListHandle> | null = null;
      let popover: HTMLDivElement | null = null;

      const place = (rect: DOMRect | null) => {
        if (!popover || !rect) return;
        popover.style.position = "fixed";
        popover.style.left = `${Math.round(rect.left)}px`;
        popover.style.top = `${Math.round(rect.bottom + 6)}px`;
        popover.style.zIndex = "1000";
      };

      return {
        onStart(props: SuggestionProps<MentionMember>) {
          renderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          popover = document.createElement("div");
          popover.appendChild(renderer.element);
          document.body.appendChild(popover);
          place(props.clientRect?.() ?? null);
        },
        onUpdate(props: SuggestionProps<MentionMember>) {
          renderer?.updateProps(props);
          place(props.clientRect?.() ?? null);
        },
        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") return true;
          return renderer?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popover?.remove();
          renderer?.destroy();
          popover = null;
          renderer = null;
        },
      };
    },
  };
}

function isDocEmpty(doc: RichTextDoc | null): boolean {
  if (!doc) return true;
  const content = Array.isArray(doc.content) ? doc.content : [];
  if (content.length === 0) return true;
  if (content.length === 1) {
    const node = content[0] as { type?: string; content?: unknown[] };
    if (node?.type === "paragraph" && (!node.content || node.content.length === 0)) {
      return true;
    }
  }
  return false;
}

const TEXT_COLORS = [
  "#1F2937", // ink (default-ish)
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#64748B", // slate
];

const HIGHLIGHT_COLORS = [
  "#FEF3C7", // amber-100
  "#FECACA", // red-200
  "#BBF7D0", // green-200
  "#BFDBFE", // blue-200
  "#DDD6FE", // violet-200
  "#FBCFE8", // pink-200
  "#E0E7FF", // indigo-200
  "#F3F4F6", // gray-100
];

export function RichTextEditor({
  initial,
  readOnly,
  name,
  placeholder = "Kontekst, acceptance criteria, linki…",
  variant = "field",
  mentionMembers,
  onChange,
  extras = "default",
  onImageUpload,
}: RichTextEditorProps) {
  const [json, setJson] = useState<string>(
    initial && !isDocEmpty(initial) ? JSON.stringify(initial) : "",
  );
  const showToolbar = variant === "field" && !readOnly;
  const showFrame = variant === "field";
  const isBriefMode = extras === "brief";

  const briefExtensions = isBriefMode
    ? [
        Table.configure({ resizable: true, HTMLAttributes: { class: "rt-table" } }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: { class: "rt-image" },
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
      ]
    : [];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: "mention-chip" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: mentionMembers
          ? buildMentionSuggestion(mentionMembers)
          : INERT_MENTION_SUGGESTION,
      }),
      ...briefExtensions,
    ],
    content: (initial as JSONContent | null) ?? undefined,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          variant === "display"
            ? "tiptap-content focus:outline-none text-[0.92rem] leading-[1.55]"
            : "tiptap-content min-h-[120px] focus:outline-none text-[0.98rem] leading-[1.6]",
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON() as RichTextDoc;
      const empty = isDocEmpty(doc);
      setJson(empty ? "" : JSON.stringify(doc));
      onChange?.(empty ? null : doc);
    },
  });

  // Sync editable in case the prop changes (rare, but cheap).
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="flex flex-col gap-2">
      {showToolbar && (
        <Toolbar
          editor={editor}
          isBriefMode={isBriefMode}
          onImageUpload={onImageUpload}
        />
      )}
      {showFrame ? (
        <div
          className="rounded-md border border-border bg-transparent px-3 py-2 transition-colors focus-within:border-primary"
          data-readonly={readOnly ? "true" : "false"}
        >
          <EditorContent editor={editor} />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
      {name !== undefined && <input type="hidden" name={name} value={json} />}
      <style>{`
        .tiptap-content p { margin: 0.25em 0; }
        .tiptap-content p:first-child { margin-top: 0; }
        .tiptap-content p:last-child { margin-bottom: 0; }
        .tiptap-content h2 { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; margin: 0.8em 0 0.3em; }
        .tiptap-content h3 { font-family: var(--font-display); font-size: 1.08rem; font-weight: 600; letter-spacing: -0.01em; margin: 0.7em 0 0.25em; }
        .tiptap-content ul, .tiptap-content ol { padding-left: 1.4em; margin: 0.3em 0; }
        .tiptap-content ul { list-style: disc; }
        .tiptap-content ol { list-style: decimal; }
        .tiptap-content li > p { margin: 0.1em 0; }
        .tiptap-content code { background: var(--muted); padding: 0.1em 0.35em; border-radius: 0.25em; font-family: var(--font-mono); font-size: 0.9em; }
        .tiptap-content pre { background: var(--muted); padding: 0.7em 0.9em; border-radius: 0.5em; margin: 0.6em 0; overflow-x: auto; font-family: var(--font-mono); font-size: 0.88em; line-height: 1.5; }
        .tiptap-content pre code { background: transparent; padding: 0; }
        .tiptap-content blockquote { border-left: 2px solid var(--border); padding-left: 0.9em; color: var(--muted-foreground); margin: 0.5em 0; font-style: italic; }
        .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--muted-foreground);
          opacity: 0.55;
          float: left;
          pointer-events: none;
          height: 0;
        }
        .tiptap-content .mention-chip {
          display: inline-flex;
          align-items: center;
          padding: 0 0.35em;
          border-radius: 0.3em;
          background: color-mix(in oklch, var(--accent-brand) 18%, transparent);
          color: var(--accent-brand);
          font-weight: 600;
          font-size: 0.94em;
          white-space: nowrap;
        }
        .tiptap-content .rt-table { border-collapse: collapse; margin: 0.6em 0; table-layout: fixed; width: 100%; overflow: hidden; }
        .tiptap-content .rt-table td, .tiptap-content .rt-table th {
          border: 1px solid var(--border);
          padding: 0.4em 0.6em;
          vertical-align: top;
          min-width: 80px;
          position: relative;
        }
        .tiptap-content .rt-table th {
          background: var(--muted);
          font-weight: 600;
          font-family: var(--font-display);
          letter-spacing: -0.005em;
        }
        .tiptap-content .rt-table .selectedCell:after {
          content: "";
          position: absolute;
          left: 0; right: 0; top: 0; bottom: 0;
          background: color-mix(in oklch, var(--primary) 15%, transparent);
          pointer-events: none;
        }
        .tiptap-content .rt-table .column-resize-handle {
          position: absolute;
          right: -2px; top: 0; bottom: -2px; width: 4px;
          background-color: color-mix(in oklch, var(--primary) 60%, transparent);
          pointer-events: none;
        }
        .tiptap-content .rt-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          margin: 0.7em auto;
        }
        .tiptap-content[data-readonly="true"] .rt-image {
          cursor: zoom-in;
        }
      `}</style>
    </div>
  );
}

function Toolbar({
  editor,
  isBriefMode,
  onImageUpload,
}: {
  editor: Editor | null;
  isBriefMode: boolean;
  onImageUpload?: (file: File) => Promise<string | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  if (!editor) {
    return <div className="h-8" aria-hidden />;
  }

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = async (file: File) => {
    if (!onImageUpload) return;
    const url = await onImageUpload(file);
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Btn
        label="Nagłówek"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        label="Pogrubienie"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon size={14} />
      </Btn>
      <Btn
        label="Kursywa"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon size={14} />
      </Btn>
      <Btn
        label="Przekreślenie"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Btn
        label="Lista punktowa"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </Btn>
      <Btn
        label="Lista numerowana"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Btn
        label="Cytat"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </Btn>
      <Btn
        label="Blok kodu"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={14} />
      </Btn>
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon size={14} />
      </Btn>

      {isBriefMode && (
        <>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />

          <div className="relative">
            <Btn
              label="Kolor tekstu"
              active={editor.isActive("textStyle") && !!editor.getAttributes("textStyle").color}
              onClick={() => {
                setColorOpen((v) => !v);
                setHighlightOpen(false);
                setTableOpen(false);
              }}
            >
              <Palette size={14} />
            </Btn>
            {colorOpen && (
              <ColorSwatchPopover
                colors={TEXT_COLORS}
                onPick={(c) => {
                  editor.chain().focus().setColor(c).run();
                  setColorOpen(false);
                }}
                onClear={() => {
                  editor.chain().focus().unsetColor().run();
                  setColorOpen(false);
                }}
              />
            )}
          </div>

          <div className="relative">
            <Btn
              label="Zaznaczenie"
              active={editor.isActive("highlight")}
              onClick={() => {
                setHighlightOpen((v) => !v);
                setColorOpen(false);
                setTableOpen(false);
              }}
            >
              <Highlighter size={14} />
            </Btn>
            {highlightOpen && (
              <ColorSwatchPopover
                colors={HIGHLIGHT_COLORS}
                onPick={(c) => {
                  editor.chain().focus().toggleHighlight({ color: c }).run();
                  setHighlightOpen(false);
                }}
                onClear={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setHighlightOpen(false);
                }}
              />
            )}
          </div>

          {/* Table */}
          <div className="relative">
            <Btn
              label="Tabela"
              active={editor.isActive("table")}
              onClick={() => {
                setTableOpen((v) => !v);
                setColorOpen(false);
                setHighlightOpen(false);
              }}
            >
              <TableIcon size={14} />
            </Btn>
            {tableOpen && (
              <TablePopover
                editor={editor}
                onAfter={() => setTableOpen(false)}
              />
            )}
          </div>

          {/* Image */}
          {onImageUpload && (
            <Btn
              label="Wstaw obraz"
              active={false}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={14} />
            </Btn>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void insertImage(file);
            }}
          />
        </>
      )}
    </div>
  );
}

function ColorSwatchPopover({
  colors,
  onPick,
  onClear,
}: {
  colors: string[];
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  // Poprzedni popover miał h-5 w-5 swatche w 8-kol gridzie —
  // ledwo klikalne. Teraz większe swatche w 4×2 gridzie, wyraźny
  // separator i pełnoszerokościowy "Usuń kolor" jako secondary CTA.
  return (
    <div className="absolute left-0 top-full z-50 mt-1 flex w-[224px] flex-col gap-2 rounded-lg border border-border bg-popover p-3 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]">
      <div className="grid grid-cols-4 gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="h-9 w-full rounded-md border border-border transition-transform hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ background: c }}
            aria-label={`Kolor ${c}`}
            title={c}
          />
        ))}
      </div>
      <div className="h-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={onClear}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Usuń kolor
      </button>
    </div>
  );
}

function TablePopover({ editor, onAfter }: { editor: Editor; onAfter: () => void }) {
  const isInTable = editor.isActive("table");
  return (
    <div className="absolute left-0 top-full z-50 mt-1 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]">
      {!isInTable ? (
        <MenuItem
          onClick={() => {
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run();
            onAfter();
          }}
        >
          Wstaw tabelę 3×3
        </MenuItem>
      ) : (
        <>
          <MenuItem onClick={() => { editor.chain().focus().addColumnAfter().run(); onAfter(); }}>
            + Kolumna w prawo
          </MenuItem>
          <MenuItem onClick={() => { editor.chain().focus().addColumnBefore().run(); onAfter(); }}>
            + Kolumna w lewo
          </MenuItem>
          <MenuItem onClick={() => { editor.chain().focus().addRowAfter().run(); onAfter(); }}>
            + Wiersz poniżej
          </MenuItem>
          <MenuItem onClick={() => { editor.chain().focus().addRowBefore().run(); onAfter(); }}>
            + Wiersz powyżej
          </MenuItem>
          <div className="my-1 h-px bg-border" />
          <MenuItem onClick={() => { editor.chain().focus().deleteColumn().run(); onAfter(); }}>
            Usuń kolumnę
          </MenuItem>
          <MenuItem onClick={() => { editor.chain().focus().deleteRow().run(); onAfter(); }}>
            Usuń wiersz
          </MenuItem>
          <MenuItem
            onClick={() => { editor.chain().focus().deleteTable().run(); onAfter(); }}
            destructive
          >
            Usuń tabelę
          </MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[0.82rem] transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Btn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-active={active ? "true" : "false"}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}
