import Link from "next/link";
import { fetchTaskDetail } from "@/lib/task-fetch";
import { TaskDetail } from "@/components/task/task-detail";

// Only allow internal paths (leading "/", no "//") — blocks protocol-relative
// redirects like //evil.com. Everything else falls back to workspace overview.
function safeBackHref(from: string | undefined, fallback: string): string {
  if (!from) return fallback;
  if (!from.startsWith("/")) return fallback;
  if (from.startsWith("//")) return fallback;
  return from;
}

function backLabel(from: string | undefined): string {
  if (from === "/my-tasks") return "← wróć do zadań dla Ciebie";
  if (from === "/my/todo") return "← wróć do TO DO";
  if (from === "/inbox") return "← wróć do powiadomień";
  return "← wróć do przeglądu";
}

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { workspaceId, taskId } = await params;
  const { from } = await searchParams;
  const data = await fetchTaskDetail(workspaceId, taskId);

  const backHref = safeBackHref(from, `/w/${workspaceId}`);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Link
        href={backHref}
        className="eyebrow inline-flex w-fit transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        {backLabel(from)}
      </Link>
      <TaskDetail {...data} />
    </div>
  );
}
