"use client";

import { startTransition, useState } from "react";
import { createTableColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { FieldOptions, FieldType } from "@/lib/table-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconPlus } from "@/components/ui/icons";
import { FieldOptionsEditor, FieldTypePicker } from "@/components/table/field-config";

// „Nowa kolumna” form — used inline in the Kolumny popover and in the header „+”.
export function AddColumnForm({ workspaceId, boardId, onDone }: { workspaceId: string; boardId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("TEXT");
  const [options, setOptions] = useState<FieldOptions>({});
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("name", trimmed);
    fd.set("type", type);
    fd.set("options", JSON.stringify(options ?? {}));
    setBusy(true);
    startTransition(async () => {
      await createTableColumnAction(fd);
      setBusy(false);
      onDone();
    });
  };
  return (
    <div className="flex flex-col gap-2.5" data-ui="add-column-form">
      <p className="text-xs font-semibold">Nowa kolumna</p>
      <Input
        autoFocus
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={80}
        placeholder="Nazwa pola…"
        aria-label="Nazwa kolumny"
      />
      <span className="eyebrow">Typ</span>
      <div className="max-h-[260px] overflow-y-auto">
        <FieldTypePicker value={type} onChange={setType} showComputed />
      </div>
      <FieldOptionsEditor type={type} value={options} onChange={setOptions} />
      <div className="flex items-center justify-end gap-2 border-t border-n-100 pt-2.5">
        <Button variant="ghost" size="sm" onClick={onDone}>Anuluj</Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()} loading={busy}>Dodaj kolumnę</Button>
      </div>
    </div>
  );
}

export function AddColumnButton({ workspaceId, boardId }: { workspaceId: string; boardId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Dodaj kolumnę"
        title="Dodaj kolumnę"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 data-popup-open:bg-n-100"
      >
        <IconPlus width={14} height={14} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-3">
        <AddColumnForm workspaceId={workspaceId} boardId={boardId} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
