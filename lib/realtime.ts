// Real-time sync for Kanban ↔ Table ↔ Overview within a workspace.
// Server: broadcastWorkspaceChange() fires a message on the workspace
// channel after any mutation. Client: useWorkspaceRealtime() subscribes
// to that channel and triggers a router.refresh() so server components
// re-render with the latest data.
//
// We use Supabase Realtime *broadcast* (not postgres-changes) because:
//   - No publication config / SQL required — works on any project.
//   - We have the full mutation context in the server action so we
//     can emit exactly what changed (taskId/boardId).
//   - Clients on /table and /kanban pages both listen to the same
//     channel, so drag on Kanban updates the table instantly.

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type RealtimePayload = {
  type: "task.changed" | "board.changed";
  taskId?: string;
  boardId?: string;
  source?: string; // optional actor/session ID — suppress self-echoes
};

// F12-K99: 2s hard timeout na każdy broadcast. SDK Supabase Realtime
// `channel.send()` może hang'ować w nieskończoność gdy kanał nie ma
// subskrybenta lub Supabase nie odpowiada — wcześniej blokowało to
// `createTaskAction` w `await` chain (user widział "Tworzę…" forever).
// Po 2s odpuszczamy — broadcast to nice-to-have, nie krytyczna ścieżka.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race<T | null>([
    p,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn(`[realtime] ${label} timed out after ${ms}ms`);
        resolve(null);
      }, ms);
    }),
  ]);
}

export async function broadcastWorkspaceChange(
  workspaceId: string,
  payload: RealtimePayload,
): Promise<void> {
  try {
    const sb = createSupabaseAdminClient();
    const channel = sb.channel(`workspace:${workspaceId}`);
    await withTimeout(
      channel.send({ type: "broadcast", event: "change", payload }),
      2000,
      `workspace broadcast (${workspaceId})`,
    );
    await withTimeout(sb.removeChannel(channel), 500, "removeChannel");
  } catch (e) {
    // Don't fail the user action if realtime broadcast fails.
    console.warn("[realtime] broadcast failed:", e);
  }
}

// Per-user broadcast — kanał `user:<userId>`. Live powiadomienia
// (toast) bez poll. Subskrypcja przez `useUserRealtime` w `<UserToaster>`.
// Payload niesie tylko ID — klient dofetchuje szczegóły.
export type UserRealtimePayload =
  | { kind: "notification.new"; id: string }
  | { kind: "reminder.due"; id: string };

export async function broadcastUserChange(
  userId: string,
  payload: UserRealtimePayload,
): Promise<void> {
  try {
    const sb = createSupabaseAdminClient();
    const channel = sb.channel(`user:${userId}`);
    await withTimeout(
      channel.send({ type: "broadcast", event: "change", payload }),
      2000,
      `user broadcast (${userId})`,
    );
    await withTimeout(sb.removeChannel(channel), 500, "removeChannel");
  } catch (e) {
    console.warn("[realtime] user broadcast failed:", e);
  }
}
