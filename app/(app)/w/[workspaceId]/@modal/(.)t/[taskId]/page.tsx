import { fetchTaskDetail } from "@/lib/task-fetch";
import { readTaskMeta } from "@/components/task/task-detail-reads";
import { TaskDetail } from "@/components/task/task-detail";
import { TaskModalShell } from "@/components/task/task-modal-shell";

// ?mode=modal → centered 960 dialog (⌘K / notifications); default = 600 side panel.
export default async function InterceptedTaskModal({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { workspaceId, taskId } = await params;
  const { mode } = await searchParams;
  const [data, meta] = await Promise.all([fetchTaskDetail(workspaceId, taskId), readTaskMeta(workspaceId, taskId)]);
  const shellMode = mode === "modal" ? "modal" : "panel";

  return (
    <TaskModalShell taskId={taskId} mode={shellMode}>
      <TaskDetail {...data} meta={meta} mode={shellMode} />
    </TaskModalShell>
  );
}
