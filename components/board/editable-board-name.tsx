"use client";

import { renameBoardAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { EditableTitle } from "@/components/ui/editable-title";

// F12-K61: cienki client wrapper dla board name inline edit. renameBoardAction
// już istnieje (wcześniej tylko serwer, zero UI), tu po prostu wystawiamy go
// w nagłówku BoardHeader przez generyczny EditableTitle.
export function EditableBoardName({
  workspaceId,
  boardId,
  name,
  canEdit,
  className,
}: {
  workspaceId: string;
  boardId: string;
  name: string;
  canEdit: boolean;
  className?: string;
}) {
  return (
    <EditableTitle
      value={name}
      canEdit={canEdit}
      className={className}
      maxLength={80}
      ariaLabel="Edytuj nazwę tablicy"
      onCommit={async (next) => {
        const fd = new FormData();
        fd.set("workspaceId", workspaceId);
        fd.set("id", boardId);
        fd.set("name", next);
        // F12-K61: NIE set description — renameBoardAction po fix'ie pomija
        // pole gdy nie podane, więc istniejący opis tablicy zostaje nietknięty.
        await renameBoardAction(fd);
      }}
    />
  );
}
