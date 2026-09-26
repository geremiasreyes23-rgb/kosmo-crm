"use client";

import { useMemo, useState } from "react";
import { FeedAvatar } from "@/components/feed/FeedAvatar";
import { FeedMentionText } from "@/components/feed/FeedMentionText";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import { Button } from "@/components/ui/Button";
import { createCommentAction } from "@/lib/feed/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { FeedCommentVM, FeedPostVM, FeedUserOption } from "@/types";
import { CornerDownRight, X } from "lucide-react";

function CommentRow({
  comment,
  onReply,
}: {
  comment: FeedCommentVM;
  onReply: (comment: FeedCommentVM) => void;
}) {
  return (
    <div className="flex gap-2.5">
      <FeedAvatar author={comment.author} size={30} />
      <div className="min-w-0 flex-1">
        <div className="rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-[var(--ink-primary)]">{comment.author.name}</span>
            <span className="text-xs text-[var(--ink-secondary)]">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          {comment.replyToAuthorName && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-secondary)]">
              <CornerDownRight size={11} /> respondiendo a {comment.replyToAuthorName}
            </p>
          )}
          <FeedMentionText text={comment.body} className="mt-1 block whitespace-pre-wrap text-sm text-[var(--ink-primary)]" />
        </div>
        <button
          type="button"
          onClick={() => onReply(comment)}
          className="mt-1 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--brand-500)]"
        >
          Responder
        </button>
      </div>
    </div>
  );
}

export function FeedComments({
  post,
  users,
  onChanged,
}: {
  post: FeedPostVM;
  users: FeedUserOption[];
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<FeedCommentVM | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const topLevel = useMemo(() => post.comments.filter((c) => !c.replyToId), [post.comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, FeedCommentVM[]>();
    for (const c of post.comments) {
      if (!c.replyToId) continue;
      const list = map.get(c.replyToId) ?? [];
      list.push(c);
      map.set(c.replyToId, list);
    }
    return map;
  }, [post.comments]);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const result = await createCommentAction({ postId: post.id, body: trimmed, replyToId: replyTo?.id });
    setSubmitting(false);
    if (result.ok) {
      setBody("");
      setReplyTo(null);
      onChanged();
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border-hairline)] px-4 py-3">
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentRow comment={comment} onReply={setReplyTo} />
          {(repliesByParent.get(comment.id) ?? []).map((reply) => (
            <div key={reply.id} className="ml-9">
              <CommentRow comment={reply} onReply={setReplyTo} />
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-2.5 pt-1">
        <div className="min-w-0 flex-1">
          {replyTo && (
            <div className="mb-1 flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
              <CornerDownRight size={12} />
              Respondiendo a {replyTo.author.name}
              <button type="button" onClick={() => setReplyTo(null)} className="hover:text-[var(--status-critical)]">
                <X size={12} />
              </button>
            </div>
          )}
          <MentionTextarea
            value={body}
            onChange={setBody}
            users={users}
            placeholder="Escribe un comentario..."
            rows={1}
            onSubmitShortcut={submit}
            className="!py-1.5"
          />
        </div>
        <Button size="sm" onClick={submit} disabled={submitting || !body.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
