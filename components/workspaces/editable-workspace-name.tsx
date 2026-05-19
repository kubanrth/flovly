"use client";

import { renameWorkspaceAction } from "@/app/(app)/workspaces/actions";
import { EditableTitle } from "@/components/ui/editable-title";

// F12-K61: cienki client wrapper łączący generic EditableTitle z
// workspace-specific server action. Trzyma sygnaturę FormData w jednym
// miejscu — komponent EditableTitle pozostaje generyczny.
export function EditableWorkspaceName({
  workspaceId,
  name,
  canEdit,
  className,
}: {
  workspaceId: string;
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
      ariaLabel="Edytuj nazwę przestrzeni"
      onCommit={async (next) => {
        const fd = new FormData();
        fd.set("id", workspaceId);
        fd.set("name", next);
        await renameWorkspaceAction(fd);
      }}
    />
  );
}
