"use client";

// „Kolumny” popover body: drag to reorder, eye to hide, gear/trash for custom
// columns, „+ Dodaj kolumnę”. Persistence is the caller's (list-state).

import { startTransition, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2 } from "lucide-react";
import { configureColumnAction, deleteTableColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { FIELD_TYPE_META, type FieldOptions, type FieldType } from "@/lib/table-fields";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconEye, IconEyeOff, IconPlus, IconTrash, IconUndo } from "@/components/ui/icons";
import { FieldOptionsEditor, FieldTypePicker } from "@/components/table/field-config";
import { AddColumnForm } from "@/components/table/add-column-form";
import { BuiltinColumnIcon, FieldTypeIcon } from "@/components/table/field-icons";

export interface ColumnDef {
  id: string;
  label: string;
  // Frozen (☐/#ID/Tytuł) — always visible, not draggable.
  frozen?: boolean;
  custom?: boolean;
  fieldType?: FieldType;
  fieldOptions?: FieldOptions | null;
}

export function ColumnSettingsPanel({
  workspaceId,
  boardId,
  columns,
  columnOrder,
  hidden,
  canManage,
  onChange,
}: {
  workspaceId: string;
  boardId: string;
  columns: ColumnDef[];
  columnOrder: string[];
  hidden: string[];
  canManage: boolean;
  onChange: (next: { order: string[]; hidden: string[] }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ordered = [
    ...columnOrder.map((id) => columns.find((c) => c.id === id)).filter((c): c is ColumnDef => Boolean(c)),
    ...columns.filter((c) => !columnOrder.includes(c.id)),
  ];
  const ids = ordered.map((c) => c.id);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0 || ordered[to]?.frozen) return;
    onChange({ order: arrayMove(ids, from, to), hidden });
  };

  return (
    <div className="w-[300px]" data-ui="columns-panel">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold">Kolumny</span>
        <Button variant="ghost" size="sm" onClick={() => onChange({ order: columns.map((c) => c.id), hidden: [] })}>
          <IconUndo />
          Domyślne
        </Button>
      </div>
      <DndContext id="column-settings" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {ordered.map((c) => (
              <SortableRow
                key={c.id}
                column={c}
                hidden={hidden.includes(c.id)}
                canManage={canManage}
                onToggle={() => onChange({ order: ids, hidden: hidden.includes(c.id) ? hidden.filter((h) => h !== c.id) : [...hidden, c.id] })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {canManage && (
        <div className="mt-1.5 border-t border-n-100 pt-2">
          {adding ? (
            <AddColumnForm workspaceId={workspaceId} boardId={boardId} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setAdding(true)}>
              <IconPlus />
              Dodaj kolumnę
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableRow({ column, hidden, canManage, onToggle }: { column: ColumnDef; hidden: boolean; canManage: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id, disabled: column.frozen });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      className="group flex h-8 items-center gap-1.5 rounded-md px-1 text-sm hover:bg-n-100"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={column.frozen}
        aria-label="Przeciągnij aby przesunąć"
        className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-n-400 outline-none hover:text-foreground active:cursor-grabbing disabled:invisible"
      >
        <GripVertical size={12} strokeWidth={1.5} />
      </button>
      <span className="inline-flex size-4 shrink-0 items-center justify-center text-fg-3">
        {column.fieldType ? <FieldTypeIcon type={column.fieldType} size={12} /> : <BuiltinColumnIcon id={column.id} size={12} />}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", hidden && "text-n-400")}>{column.label}</span>
      {column.custom && column.fieldType && <span className="shrink-0 text-2xs text-fg-3">{FIELD_TYPE_META[column.fieldType].label}</span>}
      {column.custom && column.fieldType && canManage && (
        <ConfigureColumnButton columnId={column.id.replace(/^custom:/, "")} name={column.label} fieldType={column.fieldType} fieldOptions={column.fieldOptions ?? {}} />
      )}
      {column.custom && canManage && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Usuń kolumnę"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => {
            if (!confirm(`Usunąć kolumnę „${column.label}”?`)) return;
            const fd = new FormData();
            fd.set("id", column.id.replace(/^custom:/, ""));
            startTransition(() => deleteTableColumnAction(fd));
          }}
        >
          <IconTrash />
        </Button>
      )}
      {column.frozen ? (
        <span className="pr-1.5 text-2xs text-n-400">zamrożona</span>
      ) : (
        <Button variant="ghost" size="sm" iconOnly aria-label={hidden ? "Pokaż kolumnę" : "Ukryj kolumnę"} onClick={onToggle} className={cn(hidden && "text-n-400")}>
          {hidden ? <IconEyeOff /> : <IconEye />}
        </Button>
      )}
    </li>
  );
}

// Per-column gear popover: name + type + type-specific options → configureColumnAction.
export function ConfigureColumnButton({ columnId, name, fieldType, fieldOptions }: { columnId: string; name: string; fieldType: FieldType; fieldOptions: FieldOptions }) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftType, setDraftType] = useState<FieldType>(fieldType);
  const [draftOptions, setDraftOptions] = useState<FieldOptions>(fieldOptions);
  const save = () => {
    const fd = new FormData();
    fd.set("id", columnId);
    fd.set("name", draftName.trim() || name);
    fd.set("type", draftType);
    fd.set("options", JSON.stringify(draftOptions ?? {}));
    startTransition(async () => {
      await configureColumnAction(fd);
      setOpen(false);
    });
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setDraftName(name);
          setDraftType(fieldType);
          setDraftOptions(fieldOptions);
        }
        setOpen(o);
      }}
    >
      <PopoverTrigger
        aria-label="Konfiguruj kolumnę"
        title="Typ + opcje"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-200 hover:text-foreground data-popup-open:bg-n-200"
      >
        <Settings2 size={13} strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[320px] flex-col gap-2.5 p-3">
        <p className="text-xs font-semibold">Konfiguracja kolumny</p>
        <Input size="sm" value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={80} placeholder="Nazwa kolumny" aria-label="Nazwa kolumny" />
        <span className="eyebrow">Typ</span>
        <div className="max-h-[220px] overflow-y-auto">
          <FieldTypePicker value={draftType} onChange={setDraftType} showComputed />
        </div>
        <FieldOptionsEditor type={draftType} value={draftOptions} onChange={setDraftOptions} />
        <div className="flex items-center justify-end gap-2 border-t border-n-100 pt-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button size="sm" onClick={save}>Zapisz</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
