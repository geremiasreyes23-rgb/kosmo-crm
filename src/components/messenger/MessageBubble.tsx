"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Ban, Check, CheckCheck, Pin } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { splitMentions, type MentionUser } from "@/lib/mentions";
import type { ChatMessage } from "@/types";

export function MessageBubble({
  message,
  isOwn,
  onImageClick,
  onContextMenu,
  isEditing,
  onSubmitEdit,
  onCancelEdit,
  mentionUsers,
  onMentionClick,
}: {
  message: ChatMessage;
  isOwn: boolean;
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
}) {
  const isSticker = !!message.sticker;
  const hasAttachments = !!message.attachments?.length;
  const isDeleted = !!message.deletedAt;

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

  return (
    <div
      className={cn(
        "group flex animate-kosmo-fade-in-up",
        isOwn ? "justify-end" : "justify-start"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, message);
      }}
    >
      <div className={cn("flex max-w-[78%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {message.pinned && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--brand-500)]">
            <Pin className="h-3 w-3" /> Fijado
          </span>
        )}
        {isSticker ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[56px] leading-none">{message.sticker}</span>
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
                    <span key={idx}>{part.text}</span>
                  )
                )}
              </p>
            )}
            <MessageMeta message={message} isOwn={isOwn} />
          </div>
        )}
      </div>
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
