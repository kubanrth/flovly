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
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { CLIENT_ID_COOKIE } from "@/components/layout/client-id";

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
// Timer jest odwolywany po rozstrzygnieciu — wczesniej ostrzezenie „timed out"
// lecialo do logu po kazdym broadcaście, takze udanym (sugerowalo zwisy,
// ktorych nie bylo).
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[realtime] ${label} timed out after ${ms}ms`);
      resolve(null);
    }, ms);
  });
  return Promise.race<T | null>([p, timeout]).finally(() => clearTimeout(timer));
}

// Perf 2026-09-07: broadcast nie blokuje odpowiedzi akcji. Wczesniej akcja
// czekala na REST Supabase (90–250 ms, a przy zwisie do 2 s timeoutu) zanim
// wrocila do klienta. Wysylka startuje tu i dokancza sie w tle procesu Node
// (dlugozyjacy kontener, nie serverless); bledy tylko do logu — realtime to
// nice-to-have, nie sciezka krytyczna.
function fireBroadcast(channelName: string, payload: object, label: string): void {
  try {
    const sb = createSupabaseAdminClient();
    const channel = sb.channel(channelName);
    // httpSend = jawny REST (send() robil to samo fallbackiem z ostrzezeniem
    // o deprecacji); kanal nie jest dolaczany, wiec nie ma czego usuwac.
    void withTimeout(channel.httpSend("change", payload), 2000, label)
      .then((r) => { if (r && !r.success) console.warn(`[realtime] ${label} failed:`, r.error); })
      .catch((e) => console.warn(`[realtime] ${label} failed:`, e));
  } catch (e) {
    console.warn(`[realtime] ${label} failed:`, e);
  }
}

export async function broadcastWorkspaceChange(
  workspaceId: string,
  payload: RealtimePayload,
): Promise<void> {
  // `source` = id karty, ktora wykonala akcje (ciasteczko ustawiane przez
  // RouteTracker przy fokusie). Ta karta ma juz swieze dane z odpowiedzi
  // akcji i pomija echo w useWorkspaceRealtime; inne karty i urzadzenia
  // odswiezaja jak dotad. Poza request scope (cron) cookies() rzuca — wtedy
  // bez source, wszyscy odswiezaja.
  let source = payload.source;
  if (!source) {
    try { source = (await cookies()).get(CLIENT_ID_COOKIE)?.value; } catch { /* brak requestu */ }
  }
  fireBroadcast(`workspace:${workspaceId}`, { ...payload, ...(source ? { source } : {}) }, `workspace broadcast (${workspaceId})`);
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
  fireBroadcast(`user:${userId}`, payload, `user broadcast (${userId})`);
}
