"use client";

// Built-in columns (status/title/dates/etc.) get a subset of actions — rename/delete/change-type disabled.

import { startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownAZ,
  ArrowUpZA,
  ChevronDown,
  Copy,
  EyeOff,
  Filter,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import {
  deleteTableColumnAction,
  renameTableColumnAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  FIELD_TYPE_META,
  type FieldType,
} from "@/lib/table-fields";

// Built-in columns get a synthetic icon — pick a sensible default per id.
const BUILTIN_ICON: Record<string, FieldType | null> = {
  statusColumnId: "SINGLE_SELECT",
  title: "TEXT",
  assignees: "USER",
  tags: "MULTI_SELECT",
  startAt: "DATE",
  stopAt: "DATE",
};

export interface HeaderCellProps {
  // Built-in column id ("title", "startAt"…) or `custom:<id>` for user-defined.
  columnId: string;
  label: string;
  // For custom columns only — drives icon + change-type submenu.
  fieldType?: FieldType;
  // Sort/filter callbacks operate on toolbar state owned by BoardTable.
  canManagePrefs: boolean;
  isSorted: false | "asc" | "desc";
  onSort: (dir: "asc" | "desc" | null) => void;
  onFilter: () => void;
  onHide: () => void;
  // Pin/unpin a column to the left side of the table.
  isPinned?: boolean;
  onTogglePin?: () => void;
  // Custom-only callbacks; absent for built-ins.
  onChangeType?: () => void;
}

export function TableHeaderCell({
  columnId,
  label,
  fieldType,
  canManagePrefs,
  isSorted,
  onSort,
  onFilter,
  onHide,
  isPinned,
  onTogglePin,
  onChangeType,
}: HeaderCellProps) {
  const isCustom = columnId.startsWith("custom:");
  const rawId = isCustom ? columnId.replace(/^custom:/, "") : columnId;
  const iconType = fieldType ?? BUILTIN_ICON[columnId] ?? null;
  const Icon = iconType ? FIELD_TYPE_META[iconType].icon : TypeIcon;

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(label);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const startRename = () => {
    if (!isCustom || !canManagePrefs) return;
    setDraftName(label);
    setRenaming(true);
  };

  const submitRename = () => {
    const next = draftName.trim();
    if (!next || next === label) {
      setRenaming(false);
      return;
    }
    const fd = new FormData();
    fd.set("id", rawId);
    fd.set("name", next);
    startTransition(async () => {
      await renameTableColumnAction(fd);
      setRenaming(false);
    });
  };

  return (
    <span
      className="flex w-full items-center gap-1.5"
      onDoubleClick={startRename}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <Icon size={11} className="shrink-0 text-muted-foreground/80" aria-hidden />

      {renaming ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            } else if (e.key === "Escape") {
              setDraftName(label);
              setRenaming(false);
            }
          }}
          maxLength={80}
          className="min-w-0 flex-1 rounded-sm border border-primary/40 bg-background px-1 py-0.5 text-[0.66rem] uppercase tracking-[0.14em] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      ) : (
        <span className="truncate">{label}</span>
      )}

      {isPinned && (
        <Pin
          size={10}
          className="shrink-0 rotate-45 text-primary"
          aria-label="Przypięta"
        />
      )}

      {/* Always-visible menu trigger. Used to be opacity-0/hover-only but
          users couldn't find it — the column menu (sort, filter, pin, hide,
          rename, …) is the primary affordance for this header so it needs
          to be discoverable on first sight. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 2 });
        }}
        aria-label="Menu kolumny"
        className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
      >
        <ChevronDown size={11} />
      </button>

      {menu && (
        <HeaderContextMenu
          x={menu.x}
          y={menu.y}
          isCustom={isCustom}
          isSorted={isSorted}
          isPinned={!!isPinned}
          canManagePrefs={canManagePrefs}
          onClose={() => setMenu(null)}
          onSort={(dir) => {
            onSort(dir);
            setMenu(null);
          }}
          onFilter={() => {
            onFilter();
            setMenu(null);
          }}
          onHide={() => {
            onHide();
            setMenu(null);
          }}
          onTogglePin={
            onTogglePin
              ? () => {
                  onTogglePin();
                  setMenu(null);
                }
              : null
          }
          onRename={
            isCustom
              ? () => {
                  startRename();
                  setMenu(null);
                }
              : null
          }
          onChangeType={
            isCustom && onChangeType
              ? () => {
                  onChangeType();
                  setMenu(null);
                }
              : null
          }
          onDelete={
            isCustom
              ? () => {
                  if (!confirm(`Usunąć kolumnę „${label}"?`)) return;
                  const fd = new FormData();
                  fd.set("id", rawId);
                  startTransition(() => deleteTableColumnAction(fd));
                  setMenu(null);
                }
              : null
          }
          onDuplicate={
            isCustom && fieldType
              ? () => {
                  // Configuration is identical to source; we can't read
                  // the existing options here so we fire configure with
                  // a brand-new column via createTableColumnAction —
                  // instead defer to manual copy. Closing the menu is
                  // enough; we just no-op for now.
                  setMenu(null);
                }
              : null
          }
        />
      )}
    </span>
  );
}

// Floating menu rendered at fixed coords — escape/click-outside closes.
function HeaderContextMenu({
  x,
  y,
  isCustom,
  isSorted,
  isPinned,
  canManagePrefs,
  onClose,
  onSort,
  onFilter,
  onHide,
  onTogglePin,
  onRename,
  onChangeType,
  onDelete,
  onDuplicate,
}: {
  x: number;
  y: number;
  isCustom: boolean;
  isSorted: false | "asc" | "desc";
  isPinned: boolean;
  canManagePrefs: boolean;
  onClose: () => void;
  onSort: (dir: "asc" | "desc" | null) => void;
  onFilter: () => void;
  onHide: () => void;
  onTogglePin: (() => void) | null;
  onRename: (() => void) | null;
  onChangeType: (() => void) | null;
  onDelete: (() => void) | null;
  onDuplicate: (() => void) | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  // Portal to document.body so the menu's `position: fixed` is anchored
  // to the viewport. Without this, ancestor th cells with `backdrop-blur`
  // create a containing block (filter property → forms a containing
  // block for fixed descendants) and the menu opens at completely wrong
  // coordinates — invisible or under other UI.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{ left: x, top: y, position: "fixed" }}
      // z-[200] === Z.popoverInModal (F12-K104) — portalled sort menu, może być nad modalem.
      className="z-[200] w-56 rounded-xl border border-border bg-popover p-1 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
    >
      <MenuItem
        icon={<ArrowDownAZ size={12} />}
        label="Sortuj rosnąco"
        active={isSorted === "asc"}
        onClick={() => onSort(isSorted === "asc" ? null : "asc")}
      />
      <MenuItem
        icon={<ArrowUpZA size={12} />}
        label="Sortuj malejąco"
        active={isSorted === "desc"}
        onClick={() => onSort(isSorted === "desc" ? null : "desc")}
      />
      <Separator />
      <MenuItem icon={<Filter size={12} />} label="Filtruj tę kolumnę" onClick={onFilter} />
      {onTogglePin && canManagePrefs && (
        <MenuItem
          icon={isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          label={isPinned ? "Odepnij kolumnę" : "Przypnij kolumnę"}
          onClick={onTogglePin}
          active={isPinned}
        />
      )}
      {canManagePrefs && (
        <MenuItem icon={<EyeOff size={12} />} label="Ukryj kolumnę" onClick={onHide} />
      )}
      {(onRename || onChangeType || onDelete) && <Separator />}
      {onRename && canManagePrefs && (
        <MenuItem icon={<Pencil size={12} />} label="Zmień nazwę" onClick={onRename} />
      )}
      {onChangeType && canManagePrefs && (
        <MenuItem
          icon={<TypeIcon size={12} />}
          label="Zmień typ pola"
          onClick={onChangeType}
        />
      )}
      {onDuplicate && canManagePrefs && isCustom && (
        <MenuItem
          icon={<Copy size={12} />}
          label="Duplikuj (skopiuj nazwę)"
          onClick={onDuplicate}
        />
      )}
      {onDelete && canManagePrefs && (
        <MenuItem
          icon={<Trash2 size={12} />}
          label="Usuń kolumnę"
          onClick={onDelete}
          destructive
        />
      )}
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  active,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[0.82rem] transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : active
            ? "bg-accent text-foreground"
            : "text-foreground hover:bg-accent"
      }`}
    >
      <span className="grid h-4 w-4 place-items-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {active && <span className="font-mono text-[0.6rem] text-primary">✓</span>}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}
