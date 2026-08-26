import { fetchTaskDetail } from "@/lib/task-fetch";
import { readTaskMeta } from "@/components/task/task-detail-reads";
import { TaskDetail } from "@/components/task/task-detail";
import { TaskModalShell } from "@/components/task/task-modal-shell";

// Full-page task view (B2-pełna-strona): breadcrumb bar + content 720 + „Szczegóły" 280.
// Route is full-bleed (RouteFrame) and fills the viewport under the 48px top bar.
//
// `?mode=modal` renders the 960 dialog instead. The intercepting route can only
// fire for navigations that happen inside `w/[workspaceId]`, so links from
// /inbox or Cmd+K land here — and used to get the full page even though they
// asked for a modal.
export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { workspaceId, taskId } = await params;
  const { mode } = await searchParams;
  const [data, meta] = await Promise.all([fetchTaskDetail(workspaceId, taskId), readTaskMeta(workspaceId, taskId)]);

  if (mode === "modal") {
    return (
      <TaskModalShell taskId={taskId} mode="modal">
        <TaskDetail {...data} meta={meta} mode="modal" />
      </TaskModalShell>
    );
  }

  return (
    <div className="h-[calc(100dvh-var(--topbar))]" data-ui="task-page">
      <TaskDetail {...data} meta={meta} mode="page" />
    </div>
  );
}
