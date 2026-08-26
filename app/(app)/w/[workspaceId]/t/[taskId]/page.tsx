import { fetchTaskDetail } from "@/lib/task-fetch";
import { readTaskMeta } from "@/components/task/task-detail-reads";
import { TaskDetail } from "@/components/task/task-detail";

// Full-page task view (B2-pełna-strona): breadcrumb bar + content 720 + „Szczegóły" 280.
// Route is full-bleed (RouteFrame) and fills the viewport under the 48px top bar.
export default async function TaskPage({ params }: { params: Promise<{ workspaceId: string; taskId: string }> }) {
  const { workspaceId, taskId } = await params;
  const [data, meta] = await Promise.all([fetchTaskDetail(workspaceId, taskId), readTaskMeta(workspaceId, taskId)]);
  return (
    <div className="h-[calc(100dvh-var(--topbar))]" data-ui="task-page">
      <TaskDetail {...data} meta={meta} mode="page" />
    </div>
  );
}
