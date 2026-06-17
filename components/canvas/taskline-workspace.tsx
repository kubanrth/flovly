"use client";

import { useMemo } from "react";
import { CanvasEditorLazy } from "@/components/canvas/canvas-editor-lazy";
import type {
  BoardTaskMeta,
  EditorInitialEdge,
  EditorInitialNode,
} from "@/components/canvas/canvas-editor";
import { TaskLineSidebar } from "@/components/canvas/taskline-sidebar";

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

// F12-K73: orchestrator widoku Task Line. Sidebar po lewej (search + filter +
// draggable cards), CanvasEditor po prawej z props boardTasks Map'ą — drop
// handler tworzy TASK_REF node przy upuszczeniu task'a z sidebar'a.
export function TaskLineWorkspace({
  workspaceId,
  boardId: _boardId,
  canvasId,
  canEdit,
  canCreateTask,
  tasks,
  members,
  workspaceTasks,
  initialNodes,
  initialEdges,
}: {
  workspaceId: string;
  boardId: string;
  canvasId: string;
  canEdit: boolean;
  canCreateTask: boolean;
  tasks: TaskLineTask[];
  members: TaskLineMember[];
  workspaceTasks: { id: string; title: string }[];
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
}) {
  // Map taskId → meta dla addTaskRefNode (drop handler) — O(1) lookup.
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

  return (
    // Klient: "Zadania jak się skończy szerokość ekranu to mają schodzić w
    // dół" — flex-col na max-md (sidebar pod canvas'em na mobile),
    // flex-row na md+. Canvas dostaje większą część ekranu (flex-1) z
    // min-height żeby na mobile dało się pracować.
    <div className="flex flex-col gap-3 md:flex-row md:gap-4 h-[calc(100dvh-18rem)] min-h-[640px]">
      <TaskLineSidebar
        workspaceId={workspaceId}
        tasks={tasks}
        members={members}
      />
      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card min-h-[420px]">
        <CanvasEditorLazy
          workspaceId={workspaceId}
          canvasId={canvasId}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          workspaceTasks={workspaceTasks}
          defaultBoardId={_boardId}
          boardTasks={boardTasksMap}
        />
      </div>
    </div>
  );
}
