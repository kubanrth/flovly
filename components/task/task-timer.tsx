"use client";

import { startTransition, useEffect, useState } from "react";
import { completeTaskTimerAction, pauseTaskTimerAction, startTaskTimerAction } from "@/app/(app)/w/[workspaceId]/t/timer-actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { formatDuration } from "@/components/task/format";
import { cn } from "@/lib/utils";

export interface TaskTimerProps {
  taskId: string;
  accumulatedSeconds: number;
  startedAt: string | null;   // ISO — running since
  completedAt: string | null; // ISO — locked
  canEdit: boolean;
  // details = right column (mono total + 24px Start/Pauza/Zakończ); mobile = card row (total + 30px Start).
  variant?: "details" | "mobile";
}

export function TaskTimer({ taskId, accumulatedSeconds, startedAt, completedAt, canEdit, variant = "details" }: TaskTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const isRunning = !!startedAt && !completedAt;
  const isCompleted = !!completedAt;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
  const total = accumulatedSeconds + (isRunning ? elapsed : 0);
  const submit = (action: typeof startTaskTimerAction) => (fd: FormData) => startTransition(() => action(fd));
  const totalNode = <span className={cn("font-mono text-sm tabular-nums", isRunning && "text-orange-700")} data-ui="timer-total">{formatDuration(total)}</span>;

  if (variant === "mobile") {
    return (
      <div className="flex flex-1 items-center gap-2">
        {totalNode}
        {isCompleted ? <Chip hue="green" size="md" className="ml-auto">Zakończone</Chip> : canEdit && (
          <form action={submit(isRunning ? pauseTaskTimerAction : startTaskTimerAction)} className="m-0 ml-auto">
            <input type="hidden" name="id" value={taskId} />
            <Button type="submit" size="sm" variant={isRunning ? "secondary" : "primary"} className="h-[30px] px-3 text-xs">{isRunning ? "Pauza" : "Start"}</Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[5px]" data-running={isRunning} data-completed={isCompleted}>
      {totalNode}
      {isCompleted ? <Chip hue="green" size="md" className="w-fit">Zakończone</Chip> : canEdit && (
        <div className="flex gap-1">
          <form action={submit(startTaskTimerAction)} className="m-0">
            <input type="hidden" name="id" value={taskId} />
            <Button type="submit" size="sm" disabled={isRunning} className="h-6 rounded-sm px-2 text-2xs">Start</Button>
          </form>
          <form action={submit(pauseTaskTimerAction)} className="m-0">
            <input type="hidden" name="id" value={taskId} />
            <Button type="submit" variant="secondary" size="sm" disabled={!isRunning} className="h-6 rounded-sm px-2 text-2xs text-n-600">Pauza</Button>
          </form>
          <Button variant="secondary" size="sm" disabled={!isRunning && accumulatedSeconds === 0} onClick={() => setConfirming(true)} className="h-6 rounded-sm px-2 text-2xs text-n-600">Zakończ</Button>
        </div>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Zakończyć zadanie?</DialogTitle></DialogHeader>
          <DialogBody>
            <DialogDescription className="text-sm text-foreground">
              Zegar zostanie zablokowany na <strong className="font-mono">{formatDuration(total)}</strong>. Po zakończeniu nie da się już mierzyć czasu na tym zadaniu.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Anuluj</Button>
            <form action={(fd) => { setConfirming(false); startTransition(() => completeTaskTimerAction(fd)); }} className="m-0">
              <input type="hidden" name="id" value={taskId} />
              <Button type="submit">Tak, zakończ</Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
