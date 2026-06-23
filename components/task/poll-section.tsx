"use client";

import { startTransition, useState } from "react";
import { Vote, Plus, X, Trash2, Lock, Check } from "lucide-react";
import {
  castPollVoteAction,
  closePollAction,
  createPollAction,
  deletePollAction,
} from "@/app/(app)/w/[workspaceId]/t/poll-actions";

export interface PollOptionData {
  id: string;
  label: string;
  voteCount: number;
}

export interface PollData {
  id: string;
  question: string;
  authorId: string;
  closedAt: string | null;
  options: PollOptionData[];
  totalVotes: number;
  myVoteOptionId: string | null;
}

export function PollSection({
  taskId,
  poll,
  canManage,
  canVote,
  currentUserId,
}: {
  taskId: string;
  poll: PollData | null;
  canManage: boolean;
  canVote: boolean;
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);

  if (!poll) {
    if (!canManage) {
      return null;
    }
    return (
      <section className="flex flex-col gap-3">
        <span className="eyebrow">Głosowanie</span>
        {creating ? (
          <PollCreator taskId={taskId} onClose={() => setCreating(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Vote size={12} /> Dodaj głosowanie
          </button>
        )}
      </section>
    );
  }

  const closed = poll.closedAt !== null;
  const isAuthor = poll.authorId === currentUserId;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">Głosowanie</span>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            {poll.totalVotes} {poll.totalVotes === 1 ? "głos" : "głosów"}
            {closed ? " · zamknięte" : ""}
          </span>
        </div>
        {isAuthor && (
          <div className="flex items-center gap-3">
            {!closed && (
              <form
                action={(fd) => startTransition(() => closePollAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="pollId" value={poll.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Lock size={11} /> zamknij
                </button>
              </form>
            )}
            <form
              action={(fd) => startTransition(() => deletePollAction(fd))}
              className="m-0"
            >
              <input type="hidden" name="pollId" value={poll.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={11} /> usuń
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-display text-[1rem] font-semibold leading-tight tracking-[-0.01em]">
          {poll.question}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {poll.options.map((o) => {
            const pct =
              poll.totalVotes === 0
                ? 0
                : Math.round((o.voteCount / poll.totalVotes) * 100);
            const mine = poll.myVoteOptionId === o.id;
            const disabled = closed || !canVote;
            return (
              <form
                key={o.id}
                action={(fd) => startTransition(() => castPollVoteAction(fd))}
                className="m-0"
              >
                <input type="hidden" name="pollId" value={poll.id} />
                <input type="hidden" name="optionId" value={o.id} />
                <button
                  type="submit"
                  disabled={disabled}
                  data-mine={mine ? "true" : "false"}
                  className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors data-[mine=true]:border-primary/60 disabled:cursor-default enabled:hover:border-primary/40"
                >
                  {/* Progress bar */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-500 group-data-[mine=true]:bg-primary/20"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative z-10 flex flex-1 items-center gap-2 truncate text-[0.92rem]">
                    {mine && <Check size={13} className="shrink-0 text-primary" />}
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="relative z-10 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {pct}% · {o.voteCount}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PollCreator({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<string[]>(["", ""]);

  const updateOption = (i: number, v: string) => {
    setOptions((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  };
  const addOption = () => {
    if (options.length >= 5) return;
    setOptions((prev) => [...prev, ""]);
  };
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createPollAction(fd);
          onClose();
        })
      }
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Pytanie</span>
        <input
          name="question"
          required
          minLength={3}
          maxLength={280}
          placeholder="Który wariant wybieramy?"
          autoFocus
          className="border-b border-border bg-transparent pb-1 font-display text-[1rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Opcje ({options.length}/5)</span>
        {options.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              name="option"
              value={v}
              onChange={(e) => updateOption(i, e.target.value)}
              required
              maxLength={120}
              placeholder={`Opcja ${i + 1}`}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              aria-label="Usuń opcję"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {options.length < 5 && (
          <button
            type="button"
            onClick={addOption}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus size={11} /> Dodaj opcję
          </button>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-brand-gradient px-4 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-90"
        >
          Utwórz głosowanie
        </button>
      </div>
    </form>
  );
}
