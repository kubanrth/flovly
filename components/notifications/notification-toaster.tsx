"use client";

// Globalny toaster powiadomień. Subskrybuje user-realtime kanał
// (`user:<userId>`) i wyświetla card w prawym górnym rogu na każde nowe
// powiadomienie — niezależnie od strony na której user jest. Klik na
// kartę = nawigacja do powiadomienia (workspace/task/support). Klik X =
// dismiss (lokalny — nie usuwa z DB; user może wrócić do inbox'a).
//
// Stack:
//   - Max 5 kart w widocznym stosie (starsze auto-dismiss).
//   - Auto-dismiss po 12s — toast notification ma być pomocny, nie
//     blokować ekranu na zawsze.
//   - Hover na karcie wstrzymuje auto-dismiss (UX standard).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Bell,
  CheckCircle2,
  UserPlus,
  Vote,
  X,
} from "lucide-react";
import { useUserRealtime } from "@/hooks/use-user-realtime";
import {
  getNotificationForToastAction,
  type ToastNotificationPayload,
} from "@/app/(app)/inbox/actions";

const AUTO_DISMISS_MS = 12_000;
const MAX_VISIBLE = 5;
// Fallback: jeśli animationend nigdy nie dojdzie (np. tab w tle), tick
// twardo usuwa karty wiszące w stanie leaving dłużej niż to.
const LEAVING_TIMEOUT_MS = 1_000;

interface ToastItem extends ToastNotificationPayload {
  // Klient-only: kiedy toast został zaserwowany — używane do auto-dismiss.
  shownAt: number;
  // Karta gra exit-animację; usunięcie ze state'u robi onAnimationEnd.
  leaving?: boolean;
  leavingAt?: number;
}

export function NotificationToaster({ userId }: { userId: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const hoverIdRef = useRef<string | null>(null);

  // Realtime: nowy notification.new event → fetch szczegóły → pokaz toast.
  const onChange = useCallback(async (payload: { kind: string; id: string }) => {
    if (payload.kind !== "notification.new") return;
    const res = await getNotificationForToastAction({ id: payload.id });
    if (!res.ok) return;
    setItems((prev) => {
      // Dedup — jeśli ten sam id już w stosie (np. duplikat broadcast'u),
      // przesuń go na górę zamiast duplikować.
      const without = prev.filter((p) => p.id !== res.notification.id);
      const next: ToastItem = {
        ...res.notification,
        shownAt: Date.now(),
      };
      return [next, ...without].slice(0, MAX_VISIBLE);
    });
  }, []);

  useUserRealtime(userId, onChange);

  // Pause interval when tab is hidden — avoids background re-renders.
  useEffect(() => {
    if (items.length === 0) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      setItems((prev) => {
        const now = Date.now();
        let changed = false;
        const next: ToastItem[] = [];
        for (const t of prev) {
          if (t.leaving) {
            // Exit-animacja gra; usuwa onAnimationEnd. Twardy fallback
            // gdyby event przepadł (tab w tle nie gra animacji).
            if (now - (t.leavingAt ?? now) > LEAVING_TIMEOUT_MS) {
              changed = true;
              continue;
            }
            next.push(t);
            continue;
          }
          if (
            hoverIdRef.current !== t.id &&
            now - t.shownAt >= AUTO_DISMISS_MS
          ) {
            changed = true;
            next.push({ ...t, leaving: true, leavingAt: now });
            continue;
          }
          next.push(t);
        }
        return changed ? next : prev;
      });
    };
    const start = () => {
      if (id !== null) return;
      id = setInterval(tick, 1_000);
    };
    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };
    if (document.visibilityState === "visible") start();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Wracamy z tła — od razu czyść stale toasty.
        tick();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [items.length]);

  // Dismiss = odpal exit-animację; faktyczne usunięcie robi onAnimationEnd
  // (remove). Dzięki temu karta wychodzi płynnie zamiast znikać skokowo.
  const dismiss = (id: string) => {
    setItems((prev) =>
      prev.map((t) =>
        t.id === id && !t.leaving
          ? { ...t, leaving: true, leavingAt: Date.now() }
          : t,
      ),
    );
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Powiadomienia"
      aria-live="polite"
      aria-atomic="false"
      // z-[80] === Z.toast (F12-K104) — pod modal/backdrop ale nad fab/sticky.
      className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[360px] flex-col gap-2 max-md:top-16"
    >
      {items.map((t) => (
        <ToastCard
          key={t.id}
          item={t}
          onDismiss={() => dismiss(t.id)}
          onRemove={() => remove(t.id)}
          onMouseEnter={() => (hoverIdRef.current = t.id)}
          onMouseLeave={() => {
            if (hoverIdRef.current === t.id) hoverIdRef.current = null;
          }}
        />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
  onRemove,
  onMouseEnter,
  onMouseLeave,
}: {
  item: ToastItem;
  onDismiss: () => void;
  onRemove: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const Icon = iconFor(item.iconKind);
  const colorClass = colorFor(item.iconKind);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-leaving={item.leaving ? "" : undefined}
      onAnimationEnd={() => {
        // Gdy leaving, jedyna grająca animacja to toast-out → koniec =
        // bezpieczne usunięcie. Enter-animacja nie ma ustawionego leaving.
        if (item.leaving) onRemove();
      }}
      className="toast-card pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_18px_40px_-16px_rgba(76,29,149,0.32),0_10px_26px_-10px_rgba(124,92,255,0.20)] backdrop-blur"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${colorClass}`}
        aria-hidden
      >
        <Icon size={14} />
      </span>

      <Link
        href={item.href}
        onClick={onDismiss}
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="truncate font-display text-[0.92rem] font-semibold leading-tight tracking-[-0.01em]">
          {item.title}
        </span>
        {item.body && (
          <span className="truncate text-[0.82rem] text-muted-foreground">
            {item.body}
          </span>
        )}
        <span className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-primary">
          klik = otwórz
        </span>
      </Link>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Zamknij"
        title="Zamknij"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function iconFor(
  kind: ToastNotificationPayload["iconKind"],
): typeof Bell {
  switch (kind) {
    case "mention":
      return AtSign;
    case "poll":
      return Vote;
    case "assigned":
      return UserPlus;
    case "support":
      return CheckCircle2;
    default:
      return Bell;
  }
}

function colorFor(kind: ToastNotificationPayload["iconKind"]): string {
  switch (kind) {
    case "mention":
      return "bg-primary/10 text-primary";
    case "poll":
      return "bg-amber-500/10 text-amber-500";
    case "assigned":
      return "bg-emerald-500/10 text-emerald-500";
    case "support":
      return "bg-blue-500/10 text-blue-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}
