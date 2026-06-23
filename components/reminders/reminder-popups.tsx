"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { dismissReminderAction } from "@/app/(app)/my/reminders/actions";
import { useUserRealtime } from "@/hooks/use-user-realtime";

export interface DuePopup {
  id: string;
  title: string;
  body: string | null;
  creatorName: string;
  isSelfAuthored: boolean;
}

// + F11-12 (#2): stacked floating popups in the top-right corner
// for every reminder that's due + not yet dismissed by the recipient.
// Rendered once globally from the (app) layout.
//
// Timing rebuilt — wcześniej był jeden setInterval co 60s, więc
// reminder ustawiony na 'za 30s' nie pokazywał się przed kolejnym pollem
// (do 60s opóźnienia). Teraz:
//   - Initial poll natychmiast po mount (bez 60s grace period)
//   - Periodic poll co 20s (kompromis między battery a responsywnością)
//   - Visibility-change listener — gdy user wraca na taba, poll od razu
//   - Custom event `reminder:created` z innych miejsc apki triggeruje
//     manual refresh (createReminderAction po zapisie dispatch'uje go)
export function ReminderPopups({
  initial,
  userId,
}: {
  initial: DuePopup[];
  userId: string;
}) {
  // Client-side mirror so "dismiss" hides the card immediately — we
  // don't need to await the server round-trip to remove it visually.
  const [list, setList] = useState<DuePopup[]>(initial);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setList(initial);
  }, [initial]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders/due", { cache: "no-store" });
      if (!res.ok) return;
      const data: { items: DuePopup[] } = await res.json();
      if (cancelledRef.current) return;
      // Replace state with fresh list — server is source of truth.
      setList(data.items);
    } catch {
      /* swallow — net hiccup */
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    // Immediate poll on mount so fresh reminders appear without waiting.
    void refetch();
    // Realtime (useUserRealtime reminder.due) is primary; this 60s poll is the fallback.
    const id = setInterval(refetch, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Dispatch `reminder:created` event to force immediate refetch.
    const onReminderCreated = () => void refetch();
    window.addEventListener("reminder:created", onReminderCreated);

    return () => {
      cancelledRef.current = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("reminder:created", onReminderCreated);
    };
  }, [refetch]);

  // Subskrybuj user-realtime — gdy `reminder.due` przyjdzie
  // (np. broadcast z innego miejsca apki / cron'a), refetchuj listę
  // od razu zamiast czekać 20s na poll.
  useUserRealtime(
    userId,
    useCallback(
      (payload) => {
        if (payload.kind === "reminder.due") {
          void refetch();
        }
      },
      [refetch],
    ),
  );

  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[340px] flex-col gap-2 max-md:top-16">
      {list.map((r) => (
        <ReminderBubble
          key={r.id}
          reminder={r}
          onDismiss={() => setList((prev) => prev.filter((x) => x.id !== r.id))}
        />
      ))}
    </div>
  );
}

function ReminderBubble({
  reminder,
  onDismiss,
}: {
  reminder: DuePopup;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)] backdrop-blur">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <Bell size={14} />
      </span>

      <Link
        href="/my/reminders"
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="truncate font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em]">
          {reminder.title}
        </span>
        {reminder.body && (
          <span className="truncate text-[0.82rem] text-muted-foreground">
            {reminder.body}
          </span>
        )}
        <span className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {reminder.isSelfAuthored ? "Ty sobie" : `od ${reminder.creatorName}`}
        </span>
      </Link>

      <form
        action={(fd) =>
          startTransition(() => {
            dismissReminderAction(fd);
            onDismiss();
          })
        }
        className="m-0"
      >
        <input type="hidden" name="id" value={reminder.id} />
        <button
          type="submit"
          aria-label="Schowaj"
          title="Schowaj (zostaje na liście)"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      </form>
    </div>
  );
}
