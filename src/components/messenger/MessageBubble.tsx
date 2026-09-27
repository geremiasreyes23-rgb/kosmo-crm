"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Ban, Check, CheckCheck, Pin, SmilePlus } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { splitMentions, type MentionUser } from "@/lib/mentions";
import { renderTextWithEmoji } from "@/lib/emojiText";
import { Emoji } from "./Emoji";
import { ReactionPicker } from "./ReactionPicker";
import { isImageSticker } from "@/data/messenger";
import type { ChatMessage, MessageReactionGroup } from "@/types";

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  onImageClick,
  onContextMenu,
  isEditing,
  onSubmitEdit,
  onCancelEdit,
  mentionUsers,
  onMentionClick,
  onReact,
}: {
  message: ChatMessage;
  isOwn: boolean;
  /** Quién está mirando el chat — determina si UNA reacción puntual (no
   * necesariamente todo el mensaje, que puede ser de la otra persona) es
   * "mía" para resaltar la píldora y saber qué pasa al tocarla de nuevo. */
  currentUserId: string;
  onImageClick: (url: string) => void;
  /** Clic derecho sobre la burbuja — ChatPanel decide qué opciones mostrar
   * (editar/eliminar solo si es propio, copiar/fijar siempre) y abre el menú. */
  onContextMenu: (e: ReactMouseEvent, message: ChatMessage) => void;
  /** true si este es el mensaje que se está editando ahora mismo (uno a la vez). */
  isEditing?: boolean;
  onSubmitEdit?: (messageId: string, text: string) => void;
  onCancelEdit?: () => void;
  /** Directorio de usuarios contra el que se reconocen las menciones
   * ("@Nombre") dentro del texto — ver src/lib/mentions.ts. */
  mentionUsers: MentionUser[];
  /** Clic sobre una mención reconocida — abre la ficha rápida de esa persona. */
  onMentionClick: (userId: string) => void;
  /** Reacciona (o quita/cambia la reacción propia) a este mensaje. */
  onReact: (messageId: string, emoji: string) => void;
}) {
  const isSticker = !!message.sticker;
  const hasAttachments = !!message.attachments?.length;
  const isDeleted = !!message.deletedAt;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  if (isDeleted) {
    return (
      <div className={cn("flex animate-kosmo-fade-in-up", isOwn ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "flex max-w-[78%] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm italic text-[var(--ink-muted)]",
            isOwn ? "rounded-br-sm bg-[var(--surface-sunken)]/60" : "rounded-bl-sm bg-[var(--surface-sunken)]/60"
          )}
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          Mensaje eliminado
        </div>
      </div>
    );
  }

  function handleReact(emoji: string) {
    onReact(message.id, emoji);
    setReactionPickerOpen(false);
  }

  const reactTrigger = (
    <div className="relative shrink-0 self-end pb-1">
      {/* Solo aparece al pasar el mouse sobre el mensaje (group-hover, ver
          el div padre) — no ocupa espacio visual en reposo. Se mantiene
          visible mientras el selector está abierto, aunque el mouse ya no
          esté encima, para no cerrarlo de golpe al mover el cursor hacia
          los emojis. */}
      <button
        type="button"
        onClick={() => setReactionPickerOpen((v) => !v)}
        title="Reaccionar"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-secondary)] transition-opacity hover:bg-[var(--surface-hover)] active:scale-95",
          reactionPickerOpen ? "bg-[var(--surface-hover)] opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      {reactionPickerOpen && (
        <ReactionPicker
          align={isOwn ? "end" : "start"}
          onSelect={handleReact}
          onClose={() => setReactionPickerOpen(false)}
        />
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "group flex items-end gap-1 animate-kosmo-fade-in-up",
        isOwn ? "justify-end" : "justify-start"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, message);
      }}
    >
      {!isOwn && reactTrigger}
      <div className={cn("flex max-w-[78%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {message.pinned && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--brand-500)]">
            <Pin className="h-3 w-3" /> Fijado
          </span>
        )}
        {isSticker ? (
          <div className="flex flex-col items-end gap-0.5">
            {isImageSticker(message.sticker!) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.sticker} alt="Sticker" className="h-24 w-24 object-contain" />
            ) : (
              // Formato viejo: un emoji unicode suelto, de antes del pack
              // ilustrado — se sigue mostrando igual que siempre.
              <Emoji native={message.sticker!} size={56} />
            )}
            <MessageMeta message={message} isOwn={isOwn} transparent />
          </div>
        ) : isEditing ? (
          <EditBubble message={message} onSubmit={onSubmitEdit!} onCancel={onCancelEdit!} />
        ) : (
          <div
            className={cn(
              "overflow-hidden rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              isOwn
                ? "rounded-br-sm bg-[var(--chat-bubble-own-bg)] text-[var(--chat-bubble-own-text)]"
                : "rounded-bl-sm bg-[var(--chat-bubble-other-bg)] text-[var(--chat-bubble-other-text)]"
            )}
          >
            {hasAttachments && (
              <div className={cn("grid gap-1.5", message.text && "mb-1.5")}>
                {message.attachments!.map((att) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={att.id}
                    src={att.url}
                    alt={att.name ?? "Foto adjunta"}
                    onClick={() => onImageClick(att.url)}
                    className="max-h-64 w-full cursor-zoom-in rounded-lg object-cover transition-transform hover:scale-[1.01]"
                  />
                ))}
              </div>
            )}
            {message.text && (
              <p className="whitespace-pre-wrap break-words">
                {splitMentions(message.text, mentionUsers).map((part, idx) =>
                  part.userId ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMentionClick(part.userId!);
                      }}
                      className={cn(
                        "font-semibold underline-offset-2 hover:underline",
                        isOwn ? "text-[var(--chat-bubble-own-mention)]" : "text-[var(--brand-600)]"
                      )}
                    >
                      {part.text}
                    </button>
                  ) : (
                    <span key={idx}>{renderTextWithEmoji(part.text, `m${idx}`)}</span>
                  )
                )}
              </p>
            )}
            <MessageMeta message={message} isOwn={isOwn} />
          </div>
        )}
        {!!message.reactions?.length && (
          <ReactionPills reactions={message.reactions} currentUserId={currentUserId} isOwn={isOwn} onToggle={handleReact} />
        )}
      </div>
      {isOwn && reactTrigger}
    </div>
  );
}

function ReactionPills({
  reactions,
  currentUserId,
  isOwn,
  onToggle,
}: {
  reactions: MessageReactionGroup[];
  currentUserId: string;
  isOwn: boolean;
  onToggle: (emoji: string) => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}>
      {reactions.map((group) => {
        const mine = group.userIds.includes(currentUserId);
        return (
          <button
            key={group.emoji}
            type="button"
            onClick={() => onToggle(group.emoji)}
            title={mine ? "Quitar tu reacción" : "Reaccionar igual"}
            className={cn(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors active:scale-95",
              mine
                ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-600)]"
                : "border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            <Emoji native={group.emoji} size={13} />
            <span className="font-medium">{group.userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function EditBubble({
  message,
  onSubmit,
  onCancel,
}: {
  message: ChatMessage;
  onSubmit: (messageId: string, text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(message.text ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(message.id, trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="w-64 rounded-2xl border border-[var(--brand-500)] bg-[var(--surface-card)] p-2 shadow-sm">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-sm text-[var(--ink-primary)] outline-none focus:border-[var(--brand-500)]"
      />
      <div className="mt-1.5 flex justify-end gap-2 text-xs">
        <button type="button" onClick={onCancel} className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
          Cancelar
        </button>
        <button type="button" onClick={submit} className="font-medium text-[var(--brand-600)] hover:text-[var(--brand-500)]">
          Guardar
        </button>
      </div>
    </div>
  );
}

function MessageMeta({
  message,
  isOwn,
  transparent = false,
}: {
  message: ChatMessage;
  isOwn: boolean;
  transparent?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
        transparent
          ? "text-[var(--ink-muted)]"
          : isOwn
          ? "text-[var(--chat-bubble-own-meta)]"
          : "text-[var(--ink-muted)]"
      )}
    >
      {message.editedAt && <span className="italic">editado</span>}
      <span>{formatTime(message.sentAt)}</span>
      {isOwn && message.status && (
        <>
          {message.status === "SENT" && <Check className="h-3 w-3" />}
          {message.status === "DELIVERED" && <CheckCheck className="h-3 w-3" />}
          {message.status === "READ" && <CheckCheck className="h-3 w-3 text-[var(--chat-check-read)]" />}
        </>
      )}
    </div>
  );
}
