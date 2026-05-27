// Supabase Realtime provider for a canvas Y.Doc.
//
// Protocol on the `canvas:{id}` broadcast channel:
//   event "sync":   { from: clientId, update: base64 }
//     Sent whenever the local doc mutates (origin === LOCAL_ORIGIN).
//     Remote peers apply it with REMOTE_ORIGIN so our own observer
//     skips re-broadcast (infinite loop guard).
//   event "request-state": { from: clientId }
//     Newly-joined peers ask everyone else for their current state.
//     Anyone who can answer broadcasts a full-doc "sync" in reply.
//
// On first subscribe the joiner emits "request-state"; no-one else
// responds if the doc is empty, which is fine — we then hydrate from
// the DB-seeded initial state.
//
// No state persistence here: the server route passes initialNodes +
// initialEdges from ProcessNode/ProcessEdge rows, and the editor
// seeds the Y.Doc on mount before the provider attaches.

"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  applyRemoteUpdate,
  base64ToBytes,
  bytesToBase64,
  encodeUpdate,
  LOCAL_ORIGIN,
  REMOTE_ORIGIN,
  SEED_ORIGIN,
  type CanvasYRefs,
} from "@/lib/yjs/canvas-doc";

export interface CanvasPresenceState {
  clientId: string;
  name: string | null;
  color: string;
  // Cursor in world (canvas) coordinates so peers see the same point
  // regardless of their pan/zoom.
  x: number;
  y: number;
  // Bumped each broadcast so peers can detect "stale" senders → cleanup.
  ts: number;
}

export interface CanvasProviderHandle {
  clientId: string;
  disconnect: () => void;
  // Forces a resend of local state — for tests / debug.
  resync: () => void;
  // Cursor / presence pipe layered on the same channel.
  broadcastPresence: (state: Omit<CanvasPresenceState, "clientId" | "ts">) => void;
  onPresence: (cb: (states: Map<string, CanvasPresenceState>) => void) => () => void;
}

export function createCanvasRealtimeProvider(
  refs: CanvasYRefs,
  canvasId: string,
): CanvasProviderHandle {
  const sb = createSupabaseBrowserClient();
  const clientId = randomClientId();
  const channel: RealtimeChannel = sb.channel(`canvas:${canvasId}`, {
    config: { broadcast: { self: false } },
  });

  // Forward local Y.Doc writes over the wire. We only broadcast changes
  // whose origin is LOCAL — seed and remote origins are already in sync
  // on all peers.
  const onYjsUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === LOCAL_ORIGIN) {
      void channel.send({
        type: "broadcast",
        event: "sync",
        payload: { from: clientId, update: bytesToBase64(update) },
      });
    }
  };
  refs.ydoc.on("update", onYjsUpdate);

  const broadcastFullState = () => {
    const bytes = encodeUpdate(refs.ydoc);
    void channel.send({
      type: "broadcast",
      event: "sync",
      payload: { from: clientId, update: bytesToBase64(bytes) },
    });
  };

  // Cursor state keyed by clientId. Entries with ts > 5s pruned on each event.
  const presence = new Map<string, CanvasPresenceState>();
  const presenceListeners = new Set<(s: Map<string, CanvasPresenceState>) => void>();
  const PRESENCE_TTL_MS = 5_000;

  const fanOutPresence = () => {
    const now = Date.now();
    for (const [id, s] of presence) {
      if (now - s.ts > PRESENCE_TTL_MS) presence.delete(id);
    }
    for (const cb of presenceListeners) cb(new Map(presence));
  };

  channel
    .on("broadcast", { event: "sync" }, ({ payload }) => {
      const p = payload as { from?: unknown; update?: unknown };
      if (p.from === clientId) return; // self — shouldn't happen with self:false but defensive
      if (typeof p.update !== "string") return;
      try {
        applyRemoteUpdate(refs.ydoc, base64ToBytes(p.update));
      } catch {
        /* swallow: a malformed update shouldn't crash the editor */
      }
    })
    .on("broadcast", { event: "request-state" }, ({ payload }) => {
      const p = payload as { from?: unknown };
      if (p.from === clientId) return;
      // Any peer with a non-empty doc can answer. Over-broadcast is
      // cheap; Yjs merges idempotently.
      if (refs.nodes.size > 0 || refs.edges.size > 0) {
        broadcastFullState();
      }
    })
    .on("broadcast", { event: "presence" }, ({ payload }) => {
      const p = payload as Partial<CanvasPresenceState>;
      if (!p.clientId || p.clientId === clientId) return;
      if (typeof p.x !== "number" || typeof p.y !== "number") return;
      presence.set(p.clientId, {
        clientId: p.clientId,
        name: typeof p.name === "string" ? p.name : null,
        color: typeof p.color === "string" ? p.color : "#7B68EE",
        x: p.x,
        y: p.y,
        ts: typeof p.ts === "number" ? p.ts : Date.now(),
      });
      fanOutPresence();
    })
    .on("broadcast", { event: "presence-leave" }, ({ payload }) => {
      const p = payload as { clientId?: unknown };
      if (typeof p.clientId === "string") {
        presence.delete(p.clientId);
        fanOutPresence();
      }
    })
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // Joined — ask peers for their latest state.
      void channel.send({
        type: "broadcast",
        event: "request-state",
        payload: { from: clientId },
      });
    });

  // Periodic prune: handles peers who left without sending presence-leave
  // (closed tab, network drop). Runs once per second, cheap.
  const pruneTimer = setInterval(fanOutPresence, 1_000);

  const broadcastPresence: CanvasProviderHandle["broadcastPresence"] = (s) => {
    void channel.send({
      type: "broadcast",
      event: "presence",
      payload: { ...s, clientId, ts: Date.now() },
    });
  };

  return {
    clientId,
    disconnect: () => {
      void channel.send({
        type: "broadcast",
        event: "presence-leave",
        payload: { clientId },
      });
      clearInterval(pruneTimer);
      refs.ydoc.off("update", onYjsUpdate);
      void sb.removeChannel(channel);
    },
    resync: broadcastFullState,
    broadcastPresence,
    onPresence: (cb) => {
      presenceListeners.add(cb);
      cb(new Map(presence));
      return () => presenceListeners.delete(cb);
    },
  };
}

function randomClientId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Re-exported so editor tags its own writes without importing from canvas-doc.
export { LOCAL_ORIGIN, REMOTE_ORIGIN, SEED_ORIGIN };
