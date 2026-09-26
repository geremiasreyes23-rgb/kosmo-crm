"use client";

import { Search, SquarePen } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";
import type { ChatConversation, ChatMessage, ChatUser } from "@/types";

export interface ConversationSummary {
  conversation: ChatConversation;
  user: ChatUser;
  lastMessage?: ChatMessage;
  unread: number;
}

function lastMessagePreview(message?: ChatMessage, isOwn?: boolean): string {
  if (!message) return "Sin mensajes todavía";
  const prefix = isOwn ? "Tú: " : "";
  if (message.sticker) return `${prefix}${message.sticker} Sticker`;
  if (message.attachments?.length) return `${prefix}📷 Foto`;
  return `${prefix}${message.text ?? ""}`;
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  onNewChat,
  currentUserId,
  onViewProfile,
}: {
  items: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewChat: () => void;
  currentUserId: string;
  /** Clic derecho sobre la foto de un contacto — abre su ficha rápida
   * (ver UserProfileCard, en MessengerView). */
  onViewProfile: (userId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-[var(--border-hairline)] md:w-80 md:shrink-0">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-hairline)] p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversación..."
            className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-500)] focus:bg-[var(--surface-card)]"
          />
        </div>
        <button
          type="button"
          onClick={onNewChat}
          title="Nuevo chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] active:scale-95"
        >
          <SquarePen className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="p-4 text-center text-sm text-[var(--ink-muted)]">Sin resultados.</p>
        )}
        {items.map(({ conversation, user, lastMessage, unread }) => {
          const active = conversation.id === selectedId;
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-[var(--border-hairline)] px-3 py-2.5 text-left transition-colors",
                active ? "bg-[var(--brand-50)]" : "hover:bg-[var(--surface-hover)]"
              )}
            >
              <span
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onViewProfile(user.id);
                }}
                title="Clic derecho para ver su perfil"
              >
                <ChatAvatar user={user} size={44} showStatus />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{user.name}</p>
                  {lastMessage && (
                    <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                      {formatTime(lastMessage.sentAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-[var(--ink-secondary)]">
                    {lastMessagePreview(lastMessage, lastMessage?.senderId === currentUserId)}
                  </p>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)] px-1.5 text-[11px] font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
