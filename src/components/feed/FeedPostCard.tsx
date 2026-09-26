"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { FeedAvatar } from "@/components/feed/FeedAvatar";
import { FeedMentionText } from "@/components/feed/FeedMentionText";
import { FeedComments } from "@/components/feed/FeedComments";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import { Button } from "@/components/ui/Button";
import { REACTION_META, REACTION_ORDER } from "@/lib/feed/reactionMeta";
import { SYSTEM_EVENT_TITLES } from "@/lib/feed/mappers";
import { deletePostAction, editPostAction, togglePinAction, toggleReactionAction } from "@/lib/feed/actions";
import { cn, formatBytes, formatRelativeTime } from "@/lib/utils";
import type { FeedPostVM, FeedReactionType, FeedUserOption } from "@/types";
import {
  MoreHorizontal,
  Pin,
  Pencil,
  Trash2,
  Link2,
  Flag,
  MessageCircle,
  Paperclip,
  Download,
  ExternalLink,
  Newspaper,
} from "lucide-react";

function AttachmentCard({ fileName, fileUrl, sizeBytes }: { fileName: string; fileUrl: string; sizeBytes: number }) {
  const isImage = fileUrl.startsWith("data:image/");
  if (isImage) {
    return (
      <a href={fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[var(--border-hairline)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl} alt={fileName} className="max-h-64 w-auto object-cover" />
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
      <Paperclip size={15} className="shrink-0 text-[var(--ink-secondary)]" />
      <span className="min-w-0 flex-1 truncate text-[var(--ink-primary)]">{fileName}</span>
      <span className="shrink-0 text-xs text-[var(--ink-secondary)]">{formatBytes(sizeBytes)}</span>
      <a href={fileUrl} target="_blank" rel="noreferrer" title="Abrir" className="text-[var(--ink-secondary)] hover:text-[var(--brand-500)]">
        <ExternalLink size={14} />
      </a>
      <a href={fileUrl} download={fileName} title="Descargar" className="text-[var(--ink-secondary)] hover:text-[var(--brand-500)]">
        <Download size={14} />
      </a>
    </div>
  );
}

export function FeedPostCard({
  post,
  users,
  onChanged,
}: {
  post: FeedPostVM;
  users: FeedUserOption[];
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body ?? "");
  const [commentsOpen, setCommentsOpen] = useState(post.commentCount > 0);

  async function handleReact(type: FeedReactionType) {
    setReactionPickerOpen(false);
    await toggleReactionAction(post.id, type);
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta publicación? No se puede deshacer.")) return;
    await deletePostAction(post.id);
    onChanged();
  }

  async function handleTogglePin() {
    await togglePinAction(post.id, !post.isPinned);
    onChanged();
  }

  async function handleSaveEdit() {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    const result = await editPostAction(post.id, trimmed);
    if (result.ok) {
      setEditing(false);
      onChanged();
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/feed#post-${post.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setMenuOpen(false);
  }

  const isSystem = post.kind === "SYSTEM";

  return (
    <Card id={`post-${post.id}`} className={cn("scroll-mt-20 p-4", post.isPinned && "border-[var(--brand-500)]/40")}>
      {post.isPinned && (
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-500)]">
          <Pin size={12} /> Fijado
        </div>
      )}

      <div className="flex items-start gap-3">
        {isSystem ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--brand-500)]">
            <Newspaper size={18} />
          </span>
        ) : (
          post.author && <FeedAvatar author={post.author} size={40} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--ink-primary)]">
                  {isSystem ? SYSTEM_EVENT_TITLES[post.systemEventType!] : post.author?.name}
                </span>
                {!isSystem && post.audience !== "EVERYONE" && (
                  <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-[var(--ink-secondary)]">
                    {post.audienceLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-secondary)]">
                {!isSystem && post.author?.department ? `${post.author.department} · ` : ""}
                {formatRelativeTime(post.createdAt)}
                {post.editedAt ? " · editado" : ""}
              </p>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] py-1 text-sm shadow-lg">
                  {post.canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                    >
                      <Pencil size={14} /> Editar publicación
                    </button>
                  )}
                  {post.canPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleTogglePin();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                    >
                      <Pin size={14} /> {post.isPinned ? "Desfijar publicación" : "Fijar publicación"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                  >
                    <Link2 size={14} /> Copiar enlace
                  </button>
                  {post.canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleDelete();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--status-critical)] hover:bg-[var(--surface-hover)]"
                    >
                      <Trash2 size={14} /> Eliminar publicación
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      window.alert("Gracias, hemos registrado tu reporte.");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                  >
                    <Flag size={14} /> Reportar
                  </button>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <MentionTextarea value={editBody} onChange={setEditBody} users={users} rows={3} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Guardar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            post.body && (
              <FeedMentionText text={post.body} className="mt-2 block whitespace-pre-wrap text-sm text-[var(--ink-primary)]" />
            )
          )}

          {post.attachments.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {post.attachments.map((a) => (
                <AttachmentCard key={a.id} fileName={a.fileName} fileUrl={a.fileUrl} sizeBytes={a.sizeBytes} />
              ))}
            </div>
          )}

          {!isSystem && (
            <div className="mt-3 flex items-center gap-4 border-t border-[var(--border-hairline)] pt-2 text-sm">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setReactionPickerOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:bg-[var(--surface-hover)]",
                    post.myReaction ? "text-[var(--brand-500)]" : "text-[var(--ink-secondary)]"
                  )}
                >
                  <span>{post.myReaction ? REACTION_META[post.myReaction].emoji : "👍"}</span>
                  {post.myReaction ? REACTION_META[post.myReaction].label : "Reaccionar"}
                </button>
                {reactionPickerOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] p-1 shadow-lg">
                    {REACTION_ORDER.map((type) => (
                      <button
                        key={type}
                        type="button"
                        title={REACTION_META[type].label}
                        onClick={() => handleReact(type)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:scale-110 hover:bg-[var(--surface-hover)]"
                      >
                        {REACTION_META[type].emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {post.reactionCount > 0 && (
                <span className="text-xs text-[var(--ink-secondary)]">
                  {post.reactions.map((r) => `${REACTION_META[r.type].emoji} ${r.count}`).join("  ")}
                </span>
              )}

              <button
                type="button"
                onClick={() => setCommentsOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <MessageCircle size={15} />
                {post.commentCount > 0 ? `${post.commentCount} comentario${post.commentCount === 1 ? "" : "s"}` : "Comentar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {!isSystem && commentsOpen && <FeedComments post={post} users={users} onChanged={onChanged} />}
    </Card>
  );
}
