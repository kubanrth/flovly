"use client";

import { renameBoardAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { EditableTitle } from "@/components/ui/editable-title";
import { cn } from "@/lib/utils";

// Board name inline edit (A2: 20/600 + always-visible pencil). Thin wrapper
// over EditableTitle → renameBoardAction.
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
      className={cn("text-lg font-semibold tracking-[-0.2px] [&>svg]:opacity-100", className)}
      maxLength={80}
      ariaLabel="Edytuj nazwę tablicy"
      onCommit={async (next) => {
        const fd = new FormData();
        fd.set("workspaceId", workspaceId);
        fd.set("id", boardId);
        fd.set("name", next);
        // No description field — renameBoardAction skips it when absent, so
        // the existing board description stays untouched.
        await renameBoardAction(fd);
      }}
    />
  );
}
