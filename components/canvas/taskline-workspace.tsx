"use client";

import { useMemo, useState } from "react";
import { TaskLineSidebar } from "@/components/canvas/taskline-sidebar";
import {
  TaskLineFlow,
  type BoardTaskMeta,
  type TaskLineFlowItem,
  type TaskLineRowMeta,
} from "@/components/canvas/taskline-flow";

export interface TaskLineAssignee {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface TaskLineTask {
  id: string;
  title: string;
  displayId: number;
  statusName: string | null;
  statusColor: string | null;
  assignees: TaskLineAssignee[];
}

export interface TaskLineMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

// F12-K73 v3: orchestrator — multi-line task flow.
// Sidebar (lewa) + multi-row flow (prawa). Bez CanvasEditor.
export function TaskLineWorkspace({
  workspaceId,
  canvasId,
  canEdit,
  tasks,
  members,
  initialItems,
  initialRows,
}: {
  workspaceId: string;
  canvasId: string;
  canEdit: boolean;
  tasks: TaskLineTask[];
  members: TaskLineMember[];
  initialItems: TaskLineFlowItem[];
  initialRows: TaskLineRowMeta[];
}) {
  const boardTasksMap = useMemo(() => {
    const m = new Map<string, BoardTaskMeta>();
    for (const t of tasks) {
      m.set(t.id, {
        id: t.id,
        title: t.title,
        statusName: t.statusName,
        statusColor: t.statusColor,
        displayId: t.displayId,
      });
    }
    return m;
  }, [tasks]);

  // Zadania już w jakiejkolwiek linii → odfiltruj z sidebar'a.
  // State (NIE useMemo z initialItems) — sidebar musi się updateować w
  // czasie rzeczywistym gdy user drop'uje nowe lub usuwa z flow.
  // TaskLineFlow notyfikuje przez onPlacedTaskIdsChange.
  const [placedTaskIds, setPlacedTaskIds] = useState<Set<string>>(
    () => new Set(initialItems.map((i) => i.taskId)),
  );
  const availableTasks = useMemo(
    () => tasks.filter((t) => !placedTaskIds.has(t.id)),
    [tasks, placedTaskIds],
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4 h-[calc(100dvh-18rem)] min-h-[640px]">
      <TaskLineSidebar
        workspaceId={workspaceId}
        tasks={availableTasks}
        members={members}
      />
      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card min-h-[420px]">
        <TaskLineFlow
          canvasId={canvasId}
          initialItems={initialItems}
          initialRows={initialRows}
          boardTasks={boardTasksMap}
          canEdit={canEdit}
          onPlacedTaskIdsChange={setPlacedTaskIds}
        />
      </div>
    </div>
  );
}
