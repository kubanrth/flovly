"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UserRealtimePayload } from "@/lib/realtime";

// Per-user kanał `user:<userId>` dla broadcastUserChange.
// W przeciwieństwie do useWorkspaceRealtime NIE odpala router.refresh —
// consumer (UserToaster) sam dofetchuje payload po id.
export function useUserRealtime(
  userId: string | null | undefined,
  onChange: (payload: UserRealtimePayload) => void,
) {
  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowserClient();
    const channel = sb.channel(`user:${userId}`);

    channel
      .on("broadcast", { event: "change" }, (msg) => {
        const payload = msg.payload as UserRealtimePayload | undefined;
        if (!payload) return;
        onChange(payload);
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // onChange stable via useCallback in consumer — don't resub each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
