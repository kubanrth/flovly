"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
  type CreateCommentState,
  type UpdateCommentState,
} from "@/app/(app)/w/[workspaceId]/t/comment-actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import type { MentionMember } from "@/components/task/mention-list";

export interface CommentItem {
  id: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  bodyJson: RichTextDoc | null;
  createdAt: string;
  updatedAt: string;
  isAuthor: boolean;
}

export function CommentsSection({
  taskId,
  comments,
  canComment,
  canModerateComments,
  members,
}: {
  taskId: string;
  comments: CommentItem[];
  canComment: boolean;
  canModerateComments: boolean;
  members: MentionMember[];
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <span className="eyebrow">Komentarze</span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {comments.length}
        </span>
      </div>

      {comments.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentItemView
                comment={c}
                canDelete={c.isAuthor || canModerateComments}
                canEdit={c.isAuthor}
                members={members}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.88rem] text-muted-foreground">Brak komentarzy.</p>
      )}

      {canComment && <NewCommentForm taskId={taskId} members={members} />}
    </section>
  );
}

function CommentItemView({
  comment,
  canDelete,
  canEdit,
  members,
}: {
  comment: CommentItem;
  canDelete: boolean;
  canEdit: boolean;
  members: MentionMember[];
}) {
  const [editing, setEditing] = useState(false);
  const initials = (comment.author.name ?? comment.author.email).slice(0, 2).toUpperCase();
  const edited = comment.updatedAt !== comment.createdAt;

  return (
    // Borderless row — comments sit directly on drawer surface (spec).
    // The `group` flag exposes inline "Odpowiedz" link on hover.
    <article className="group flex gap-3">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.68rem] font-bold text-white"
        aria-hidden
      >
        {comment.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
            {comment.author.name ?? comment.author.email.split("@")[0]}
          </span>
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
            {formatRelative(comment.createdAt)}
            {edited ? " · edytowane" : ""}
          </span>
          <span className="ml-auto flex items-center gap-1">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edytuj"
                title="Edytuj"
                // WCAG 2.5.8: max-md bump to 44×44 (mobile touch target).
                // Desktop keeps 24×24 (cursor precision).
                className="grid h-6 w-6 max-md:h-11 max-md:w-11 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil size={12} />
              </button>
            )}
            {canDelete && !editing && <DeleteCommentButton id={comment.id} />}
          </span>
        </div>

        {editing ? (
          <EditCommentForm
            comment={comment}
            onDone={() => setEditing(false)}
            members={members}
          />
        ) : (
          <>
            <RichTextEditor
              key={`view-${comment.id}-${comment.updatedAt}`}
              initial={comment.bodyJson}
              readOnly
              variant="display"
            />
            {/* Reactions + reply row (spec). Reactions/replies still TODO
                backend-side; UI hooks render the affordance only. */}
            <div className="mt-1 flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Reaguj kciukiem"
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[0.74rem] text-primary/90 transition-colors hover:border-primary/40 hover:bg-primary/15"
              >
                <span aria-hidden>👍</span>
                <span className="font-mono text-[0.66rem] tabular-nums">0</span>
              </button>
              <button
                type="button"
                className="rounded px-1 py-0.5 text-[0.74rem] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                Odpowiedz
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function NewCommentForm({
  taskId,
  members,
}: {
  taskId: string;
  members: MentionMember[];
}) {
  const [state, formAction, pending] = useActionState<CreateCommentState, FormData>(
    createCommentAction,
    null,
  );
  // Derive the editor's key directly from the successful-submit marker.
  // React remounts the editor (clearing it) whenever state flips to a
  // new commentId. Avoids the render-body setState pattern that was
  // causing a re-render loop + visible jitter of the form box.
  const editorKey = state?.ok ? state.commentId : "pristine";

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <RichTextEditor
        key={editorKey}
        initial={null}
        readOnly={false}
        name="bodyJson"
        placeholder="Zostaw komentarz…  (napisz @ by oznaczyć osobę)"
        mentionMembers={members}
      />
      {!state?.ok && state?.fieldErrors?.bodyJson && (
        <span className="font-mono text-[0.68rem] text-destructive">
          {state.fieldErrors.bodyJson}
        </span>
      )}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {pending ? "Dodaję…" : "Dodaj komentarz"}
        </button>
      </div>
    </form>
  );
}

function EditCommentForm({
  comment,
  onDone,
  members,
}: {
  comment: CommentItem;
  onDone: () => void;
  members: MentionMember[];
}) {
  const [state, formAction, pending] = useActionState<UpdateCommentState, FormData>(
    updateCommentAction,
    null,
  );
  // FIX: track state object reference instead of doneId — new state = re-fire
  useEffect(() => {
    if (state?.ok) {
      onDone();
    }
  }, [state, onDone]);
  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={comment.id} />
      <RichTextEditor
        initial={comment.bodyJson}
        readOnly={false}
        name="bodyJson"
        mentionMembers={members}
      />
      {!state?.ok && state?.fieldErrors?.bodyJson && (
        <span className="font-mono text-[0.68rem] text-destructive">
          {state.fieldErrors.bodyJson}
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-brand-gradient px-3 font-sans text-[0.8rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Check size={13} /> {pending ? "Zapisuję…" : "Zapisz"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border px-3 font-sans text-[0.8rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={13} /> Anuluj
        </button>
      </div>
    </form>
  );
}

function DeleteCommentButton({ id }: { id: string }) {
  return (
    <form action={deleteCommentAction} className="m-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="Usuń"
        title="Usuń"
        // WCAG 2.5.8: max-md bump to 44×44 (mobile touch target).
        className="grid h-6 w-6 max-md:h-11 max-md:w-11 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={12} />
      </button>
    </form>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 45) return "przed chwilą";
  if (diff < 60 * 60) return `${Math.round(diff / 60)} min temu`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)} godz. temu`;
  if (diff < 60 * 60 * 24 * 7) return `${Math.round(diff / 86400)} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
