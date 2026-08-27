"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
  type CreateCommentState,
  type UpdateCommentState,
} from "@/app/(app)/w/[workspaceId]/t/comment-actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import type { MentionMember } from "@/components/task/mention-list";
import { formatWhen } from "@/components/task/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconEdit, IconSend, IconTrash } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface CommentItem {
  id: string;
  author: { id: string; name: string | null; email: string; avatarUrl: string | null };
  bodyJson: RichTextDoc | null;
  createdAt: string;
  updatedAt: string;
  isAuthor: boolean;
}

const displayName = (u: { name: string | null; email: string }) => u.name ?? u.email.split("@")[0]!;

// B2 comment row: avatar 24, name 12/600, mono 10 stamp, body 13/19. Edit/delete on hover.
export function CommentRow({ comment, canDelete, canEdit, members }: { comment: CommentItem; canDelete: boolean; canEdit: boolean; members: MentionMember[] }) {
  const [editing, setEditing] = useState(false);
  const edited = comment.updatedAt !== comment.createdAt;
  return (
    <article className="group flex gap-2">
      <Avatar name={displayName(comment.author)} src={comment.author.avatarUrl} size={24} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">{displayName(comment.author)}</span>
          <span className="font-mono text-[10px] text-fg-3">{formatWhen(comment.createdAt)}{edited ? " · edytowane" : ""}</span>
          {!editing && (canEdit || canDelete) && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
              {canEdit && <Button variant="ghost" size="sm" iconOnly aria-label="Edytuj" title="Edytuj" onClick={() => setEditing(true)} className="size-6"><IconEdit /></Button>}
              {canDelete && (
                <form action={deleteCommentAction} className="m-0">
                  <input type="hidden" name="id" value={comment.id} />
                  <Button type="submit" variant="ghost" size="sm" iconOnly aria-label="Usuń" title="Usuń" className="size-6 hover:text-danger-text"><IconTrash /></Button>
                </form>
              )}
            </span>
          )}
        </div>
        {editing ? (
          <EditCommentForm comment={comment} onDone={() => setEditing(false)} members={members} />
        ) : (
          <RichTextEditor key={`view-${comment.id}-${comment.updatedAt}`} initial={comment.bodyJson} readOnly variant="display" />
        )}
      </div>
    </article>
  );
}

// Composer pinned to the panel bottom: avatar 26 · single-line Tiptap 32 · orange send 32 (mobile 44/44).
export function CommentComposer({ taskId, members, author, mobile }: { taskId: string; members: MentionMember[]; author: { name: string; avatarUrl: string | null }; mobile?: boolean }) {
  const [state, formAction, pending] = useActionState<CreateCommentState, FormData>(createCommentAction, null);
  // Editor remounts (clears) when a new commentId arrives — no setState-in-render.
  const editorKey = state?.ok ? state.commentId : "pristine";
  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); e.currentTarget.requestSubmit(); } }}
      className={cn("flex items-end gap-2", mobile ? "px-3 py-2.5" : "px-3 py-2.5")}
      data-ui="comment-composer"
    >
      <input type="hidden" name="taskId" value={taskId} />
      {!mobile && <Avatar name={author.name} src={author.avatarUrl} size={26} className="mb-[3px]" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <RichTextEditor
          key={editorKey}
          initial={null}
          readOnly={false}
          name="bodyJson"
          variant={mobile ? "compact-lg" : "compact"}
          placeholder={mobile ? "Napisz komentarz…" : "Napisz komentarz… użyj @ aby wspomnieć"}
          mentionMembers={members}
        />
        {!state?.ok && state?.fieldErrors?.bodyJson && <span className="text-xs text-danger-text">{state.fieldErrors.bodyJson}</span>}
      </div>
      <Button type="submit" iconOnly size={mobile ? "lg" : "md"} loading={pending} aria-label="Wyślij komentarz" className={mobile ? "size-11" : undefined}>
        {!pending && <IconSend />}
      </Button>
    </form>
  );
}

function EditCommentForm({ comment, onDone, members }: { comment: CommentItem; onDone: () => void; members: MentionMember[] }) {
  const [state, formAction, pending] = useActionState<UpdateCommentState, FormData>(updateCommentAction, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="mt-1 flex flex-col gap-2">
      <input type="hidden" name="id" value={comment.id} />
      <RichTextEditor initial={comment.bodyJson} readOnly={false} name="bodyJson" mentionMembers={members} autoFocus />
      {!state?.ok && state?.fieldErrors?.bodyJson && <span className="text-xs text-danger-text">{state.fieldErrors.bodyJson}</span>}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>Anuluj</Button>
        <Button type="submit" size="sm" loading={pending}>Zapisz</Button>
      </div>
    </form>
  );
}
