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

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import {
  IconBell,
  IconCheckCircle,
  IconComment,
  IconClose,
  IconSupport,
  IconTasks,
  type IconProps,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
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
      className="pointer-events-none fixed top-4 right-4 z-(--z-toast) flex w-[300px] flex-col gap-2 max-md:top-16"
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
  const Icon = ICON_FOR[item.iconKind] ?? IconBell;

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
      className="toast-card surface pointer-events-auto flex items-start gap-2.5 p-3 shadow-e2"
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", HUE_FOR[item.iconKind])} aria-hidden>
        <Icon width={14} height={14} />
      </span>

      <Link
        href={item.href}
        onClick={onDismiss}
        className="flex min-w-0 flex-1 flex-col rounded-sm outline-none"
      >
        <span className="truncate text-sm font-semibold leading-5">{item.title}</span>
        {item.body && <span className="truncate text-xs text-muted-foreground">{item.body}</span>}
        <span className="mt-0.5 font-mono text-[10px] text-orange-700">klik = otwórz</span>
      </Link>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Zamknij"
        title="Zamknij"
        className="grid size-6 shrink-0 place-items-center rounded-sm text-n-500 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
      >
        <IconClose width={13} height={13} />
      </button>
    </div>
  );
}

// Static lookup — a function returning a component reads as "creating a
// component during render" to the React Compiler lint.
const ICON_FOR: Record<ToastNotificationPayload["iconKind"], (p: IconProps) => ReactElement> = {
  mention: IconComment,
  poll: IconTasks,
  assigned: IconCheckCircle,
  support: IconSupport,
  default: IconBell,
};

const HUE_FOR: Record<ToastNotificationPayload["iconKind"], string> = {
  mention: "bg-chip-orange-bg text-chip-orange-fg",
  poll: "bg-chip-purple-bg text-chip-purple-fg",
  assigned: "bg-chip-green-bg text-chip-green-fg",
  support: "bg-chip-blue-bg text-chip-blue-fg",
  default: "bg-chip-gray-bg text-chip-gray-fg",
};
