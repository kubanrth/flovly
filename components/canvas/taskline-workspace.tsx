"use client";

import { useMemo } from "react";
import { TaskLineSidebar } from "@/components/canvas/taskline-sidebar";
import {
  TaskLineFlow,
  type BoardTaskMeta,
  type TaskLineFlowItem,
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

// F12-K73 v2: orchestrator widoku Task Line.
// Layout: sidebar (lista task'ów do przeciągnięcia) + flow (sekwencja kafelków).
// Bez CanvasEditor'a — to jest dedykowany linear-flow view, nie whiteboard.
//
// Mobile: flex-col (sidebar nad flow). Desktop: flex-row.
export function TaskLineWorkspace({
  workspaceId,
  canvasId,
  canEdit,
  tasks,
  members,
  initialItems,
}: {
  workspaceId: string;
  canvasId: string;
  canEdit: boolean;
  tasks: TaskLineTask[];
  members: TaskLineMember[];
  initialItems: TaskLineFlowItem[];
}) {
  // Map taskId → meta, używana przez drop handler w TaskLineFlow przy
  // wstawianiu nowych kafelków (server zwraca tylko nodeId+x, resztę
  // bierzemy z tej mapy).
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

  // Zadania już dodane do flow → wyfiltruj z sidebar'a (UX: nie pokazujemy
  // duplikatów których nie da się drugi raz upuścić).
  const placedTaskIds = useMemo(
    () => new Set(initialItems.map((i) => i.taskId)),
    [initialItems],
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
          boardTasks={boardTasksMap}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
