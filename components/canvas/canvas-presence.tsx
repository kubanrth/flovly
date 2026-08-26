"use client";

// Stos awatarów osób obecnych na kanwie (B9, wiersz breadcrumbów).
// Nagłówek tablicy renderuje się poza drzewem edytora, więc dane obecności
// przechodzą jednokierunkowym eventem `canvas:presence` — CanvasEditor tylko
// go emituje, silnik Yjs/awareness pozostaje nietknięty.

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";

export const CANVAS_PRESENCE_EVENT = "canvas:presence";

export type CanvasPresencePerson = { id: string; name: string };

export type CanvasPresenceDetail = {
  canvasId: string;
  people: CanvasPresencePerson[];
};

export function CanvasPresenceStack({
  canvasId,
  me,
}: {
  canvasId: string;
  me: { name: string; avatarUrl?: string | null };
}) {
  const [others, setOthers] = useState<CanvasPresencePerson[]>([]);

  useEffect(() => {
    const onPresence = (e: Event) => {
      const detail = (e as CustomEvent<CanvasPresenceDetail>).detail;
      if (!detail || detail.canvasId !== canvasId) return;
      setOthers(detail.people);
    };
    window.addEventListener(CANVAS_PRESENCE_EVENT, onPresence);
    return () => window.removeEventListener(CANVAS_PRESENCE_EVENT, onPresence);
  }, [canvasId]);

  const extra = Math.max(0, others.length - 3);
  return (
    <span
      data-ui="canvas-presence"
      className="mr-1 inline-flex items-center"
      title={[me.name, ...others.map((p) => p.name)].join(", ")}
    >
      <Avatar
        name={me.name}
        src={me.avatarUrl ?? undefined}
        size={24}
        className="border-2 border-orange-500"
      />
      {others.slice(0, 3).map((p) => (
        <Avatar key={p.id} name={p.name} size={24} className="-ml-[7px] border-2 border-card" />
      ))}
      {extra > 0 && (
        <span className="-ml-[7px] grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-n-100 text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  );
}
