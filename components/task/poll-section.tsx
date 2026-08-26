"use client";

import { startTransition, useState } from "react";
import { castPollVoteAction, closePollAction, createPollAction, deletePollAction } from "@/app/(app)/w/[workspaceId]/t/poll-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconClose, IconLock, IconPlus, IconTrash } from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

export interface PollOptionData { id: string; label: string; voteCount: number }
export interface PollData {
  id: string; question: string; authorId: string; closedAt: string | null;
  options: PollOptionData[]; totalVotes: number; myVoteOptionId: string | null;
}

const votesPl = (n: number) => `${n} ${plPlural(n, "głos", "głosy", "głosów")}`;

// B2 Głosowanie: question 13/500, option rows with tinted share bar (orange = mine), mono counts.
export function PollSection({ taskId, poll, canManage, canVote, currentUserId }: { taskId: string; poll: PollData | null; canManage: boolean; canVote: boolean; currentUserId: string }) {
  const [creating, setCreating] = useState(false);

  if (!poll) {
    if (!canManage) return null;
    return (
      <section className="flex flex-col gap-2" data-ui="task-poll">
        <span className="eyebrow">Głosowanie</span>
        {creating ? <PollCreator taskId={taskId} onClose={() => setCreating(false)} /> : (
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)} className="w-fit"><IconPlus /> Utwórz głosowanie</Button>
        )}
      </section>
    );
  }

  const closed = poll.closedAt !== null;
  const isAuthor = poll.authorId === currentUserId;
  return (
    <section className="flex flex-col gap-2" data-ui="task-poll">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Głosowanie</span>
        <span className="font-mono text-2xs text-n-600">{votesPl(poll.totalVotes)}{closed ? " · zamknięte" : ""}</span>
        {isAuthor && (
          <span className="ml-auto flex items-center gap-0.5">
            {!closed && (
              <form action={(fd) => startTransition(() => closePollAction(fd))} className="m-0">
                <input type="hidden" name="pollId" value={poll.id} />
                <Button type="submit" variant="ghost" size="sm" className="-my-1 h-6 px-1.5 text-xs"><IconLock /> Zamknij</Button>
              </form>
            )}
            <form action={(fd) => startTransition(() => deletePollAction(fd))} className="m-0">
              <input type="hidden" name="pollId" value={poll.id} />
              <Button type="submit" variant="ghost" size="sm" className="-my-1 h-6 px-1.5 text-xs hover:text-danger-text"><IconTrash /> Usuń</Button>
            </form>
          </span>
        )}
      </div>
      <p className="text-sm font-medium">{poll.question}</p>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const pct = poll.totalVotes === 0 ? 0 : Math.round((o.voteCount / poll.totalVotes) * 100);
          const mine = poll.myVoteOptionId === o.id;
          return (
            <form key={o.id} action={(fd) => startTransition(() => castPollVoteAction(fd))} className="m-0">
              <input type="hidden" name="pollId" value={poll.id} />
              <input type="hidden" name="optionId" value={o.id} />
              <button type="submit" disabled={closed || !canVote} role="radio" aria-checked={mine} className="relative flex w-full items-center gap-2 overflow-hidden rounded-sm border border-border p-2 text-left outline-none enabled:hover:border-n-400 disabled:cursor-default">
                <span aria-hidden className={cn("absolute inset-y-0 left-0", mine ? "bg-orange-100" : "bg-n-100")} style={{ width: `${pct}%` }} />
                <span aria-hidden className={cn("relative size-3.5 shrink-0 rounded-full border bg-card", mine ? "border-[4.5px] border-control-on" : "border-[1.5px] border-n-400")} />
                <span className="relative min-w-0 flex-1 truncate text-xs">{o.label}</span>
                <span className="relative font-mono text-2xs text-n-600">{o.voteCount === 0 ? "0" : votesPl(o.voteCount)}</span>
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}

function PollCreator({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [options, setOptions] = useState<string[]>(["", ""]);
  return (
    <form action={(fd) => startTransition(async () => { await createPollAction(fd); onClose(); })} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <input type="hidden" name="taskId" value={taskId} />
      <label className="flex flex-col gap-1">
        <span className="text-2xs text-n-500">Pytanie</span>
        <Input name="question" required minLength={3} maxLength={280} placeholder="Który wariant wybieramy?" autoFocus />
      </label>
      <span className="text-2xs text-n-500">Opcje ({options.length}/5)</span>
      {options.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input name="option" value={v} onChange={(e) => setOptions((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))} required maxLength={120} placeholder={`Opcja ${i + 1}`} size="sm" aria-label={`Opcja ${i + 1}`} />
          <Button variant="ghost" size="sm" iconOnly aria-label="Usuń opcję" disabled={options.length <= 2} onClick={() => setOptions((p) => p.filter((_, idx) => idx !== i))}><IconClose /></Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        {options.length < 5 && <Button variant="ghost" size="sm" onClick={() => setOptions((p) => [...p, ""])}><IconPlus /> Dodaj opcję</Button>}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>Anuluj</Button>
        <Button type="submit" size="sm">Utwórz</Button>
      </div>
    </form>
  );
}
