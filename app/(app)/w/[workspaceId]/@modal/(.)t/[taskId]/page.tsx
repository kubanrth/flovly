import { fetchTaskDetail } from "@/lib/task-fetch";
import { TaskDetail } from "@/components/task/task-detail";
import { TaskModalShell } from "@/components/task/task-modal-shell";

export default async function InterceptedTaskModal({
  params,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
}) {
  const { workspaceId, taskId } = await params;
  const data = await fetchTaskDetail(workspaceId, taskId);

  return (
    <TaskModalShell taskId={taskId}>
      <TaskDetail {...data} />
    </TaskModalShell>
  );
}
