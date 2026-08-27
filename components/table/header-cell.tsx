"use client";

// Column header: click opens the column menu (B1): sort ↑/↓ · filter · group ·
// pin · hide · (custom) rename · type ▸ · delete. Built-ins get the subset.

import { startTransition, useState, type ReactNode } from "react";
import { Pin, PinOff } from "lucide-react";
import { configureColumnAction, deleteTableColumnAction, renameTableColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { ALL_FIELD_TYPES, FIELD_TYPE_META, type FieldOptions, type FieldType } from "@/lib/table-fields";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconArrowDown, IconArrowUp, IconCheck, IconChevronDown, IconEyeOff, IconFilter, IconGroup, IconPen, IconTrash } from "@/components/ui/icons";
import { FieldTypeIcon } from "@/components/table/field-icons";

export interface HeaderCellProps {
  // Built-in id ("title", "startAt"…) or `custom:<id>`.
  columnId: string;
  label: string;
  icon?: ReactNode;
  canManagePrefs: boolean;
  isSorted: false | "asc" | "desc";
  isPinned: boolean;
  // Frozen columns can't be unpinned/hidden.
  frozen?: boolean;
  fieldType?: FieldType;
  fieldOptions?: FieldOptions | null;
  onSort: (dir: "asc" | "desc" | null) => void;
  onFilter: () => void;
  onGroup: () => void;
  onHide: () => void;
  onTogglePin: () => void;
}

export function TableHeaderCell({ columnId, label, icon, canManagePrefs, isSorted, isPinned, frozen, fieldType, fieldOptions, onSort, onFilter, onGroup, onHide, onTogglePin }: HeaderCellProps) {
  const isCustom = columnId.startsWith("custom:");
  const rawId = columnId.replace(/^custom:/, "");
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(label);

  const submitRename = () => {
    const next = draft.trim();
    setRenaming(false);
    if (!next || next === label) return;
    const fd = new FormData();
    fd.set("id", rawId);
    fd.set("name", next);
    startTransition(() => renameTableColumnAction(fd));
  };
  const changeType = (type: FieldType) => {
    if (!fieldType || type === fieldType) return;
    const fd = new FormData();
    fd.set("id", rawId);
    fd.set("name", label);
    fd.set("type", type);
    fd.set("options", JSON.stringify(fieldOptions ?? {}));
    startTransition(() => configureColumnAction(fd));
  };

  if (renaming) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitRename();
          } else if (e.key === "Escape") {
            setDraft(label);
            setRenaming(false);
          }
        }}
        maxLength={80}
        aria-label="Nazwa kolumny"
        className="mx-1.5 h-6 w-[calc(100%-12px)] min-w-0 rounded-sm border border-orange-500 bg-card px-1.5 text-2xs font-semibold uppercase tracking-[.06em] text-foreground outline-none"
      />
    );
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Kolumna ${label}`}
        onDoubleClick={() => {
          if (isCustom && canManagePrefs) {
            setDraft(label);
            setRenaming(true);
          }
        }}
        className="group/th flex h-full w-full min-w-0 items-center gap-[5px] px-2.5 text-left uppercase outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[inset_0_0_0_2px_var(--orange-500)] data-popup-open:bg-n-100 data-popup-open:text-foreground"
      >
        {icon && <span className="inline-flex shrink-0 items-center text-fg-3">{icon}</span>}
        <span className="truncate">{label}</span>
        {isSorted ? (
          <IconArrowDown width={11} height={11} aria-label={isSorted === "asc" ? "posortowano rosnąco" : "posortowano malejąco"} className={cn("ml-auto shrink-0 text-fg-2", isSorted === "asc" && "rotate-180")} />
        ) : (
          <IconChevronDown width={11} height={11} className="ml-auto hidden shrink-0 text-fg-3 group-hover/th:block group-data-popup-open/th:block" />
        )}
      </MenuTrigger>
      <MenuContent align="start" className="w-56">
        <MenuItem icon={<IconArrowUp />} onClick={() => onSort(isSorted === "asc" ? null : "asc")}>
          Sortuj rosnąco
          {isSorted === "asc" && <IconCheck className="ml-auto text-success" />}
        </MenuItem>
        <MenuItem icon={<IconArrowDown />} onClick={() => onSort(isSorted === "desc" ? null : "desc")}>
          Sortuj malejąco
          {isSorted === "desc" && <IconCheck className="ml-auto text-success" />}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<IconFilter />} onClick={onFilter}>Filtruj po tym polu</MenuItem>
        <MenuItem icon={<IconGroup />} onClick={onGroup}>Grupuj wg tego pola</MenuItem>
        {canManagePrefs && (
          <>
            <MenuSeparator />
            <MenuItem icon={isPinned ? <PinOff size={14} strokeWidth={1.5} /> : <Pin size={14} strokeWidth={1.5} />} disabled={frozen} onClick={onTogglePin}>
              {isPinned ? "Odepnij kolumnę" : "Przypnij kolumnę"}
            </MenuItem>
            <MenuItem icon={<IconEyeOff />} disabled={frozen} onClick={onHide}>Ukryj kolumnę</MenuItem>
          </>
        )}
        {isCustom && canManagePrefs && fieldType && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={<IconPen />}
              onClick={() => {
                setDraft(label);
                setRenaming(true);
              }}
            >
              Zmień nazwę
            </MenuItem>
            <MenuSub>
              <MenuSubTrigger icon={<FieldTypeIcon type={fieldType} size={14} />}>
                Typ pola
                <span className="ml-auto pl-3 text-2xs text-fg-3">{FIELD_TYPE_META[fieldType].label}</span>
              </MenuSubTrigger>
              <MenuSubContent className="max-h-[60vh] w-56 overflow-y-auto">
                <MenuRadioGroup value={fieldType} onValueChange={(v) => changeType(v as FieldType)}>
                  {ALL_FIELD_TYPES.map((t) => (
                    <MenuRadioItem key={t} value={t} closeOnClick>
                      <FieldTypeIcon type={t} size={14} className="text-muted-foreground" />
                      {FIELD_TYPE_META[t].label}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuSubContent>
            </MenuSub>
            <MenuItem
              icon={<IconTrash />}
              destructive
              onClick={() => {
                if (!confirm(`Usunąć kolumnę „${label}”?`)) return;
                const fd = new FormData();
                fd.set("id", rawId);
                startTransition(() => deleteTableColumnAction(fd));
              }}
            >
              Usuń kolumnę
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
