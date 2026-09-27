"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Pin, X } from "lucide-react";
import { cn, formatDayLabel } from "@/lib/utils";
import { stickerPreviewGlyph, isImageSticker } from "@/data/messenger";
import { ChatAvatar } from "./ChatAvatar";
import { MessageBubble } from "./MessageBubble";
import { MessageContextMenu, type MessageContextMenuState } from "./MessageContextMenu";
import { ChatComposer, type ComposerSendPayload } from "./ChatComposer";
import { ChatWallpaperPicker } from "./ChatWallpaperPicker";
import type { ChatMessage, ChatUser } from "@/types";

const STATUS_LABEL: Record<ChatUser["status"], string> = {
  ONLINE: "En línea",
  AWAY: "Ausente",
  OFFLINE: "Desconectado",
};

// Fondo del chat, configurable por el usuario (colores sólidos, igual que
// WhatsApp) — se guarda en localStorage porque es una preferencia visual de
// ESTE navegador/dispositivo, no un dato que deba viajar al servidor ni
// compartirse con la otra persona de la conversación. Sin elección propia,
// se usa el fondo rosado con textura de puntos por defecto (.kosmo-chat-bg,
// ver globals.css).
const WALLPAPER_STORAGE_KEY = "kosmo:chat-wallpaper";

export function ChatPanel({
  user,
  messages,
  currentUserId,
  users,
  onSend,
  onImageClick,
  sendError,
  onEditMessage,
  onDeleteMessage,
  onTogglePinMessage,
  onReactMessage,
  onOpenProfile,
}: {
  user: ChatUser | null;
  messages: ChatMessage[];
  currentUserId: string;
  /** Directorio de la organización (todos menos "me") — se usa para el
   * autocompletado de menciones en el compositor y para reconocerlas al
   * mostrar los mensajes (ver src/lib/mentions.ts). */
  users: ChatUser[];
  onSend: (payload: ComposerSendPayload) => void;
  onImageClick: (url: string) => void;
  /** Motivo del último envío fallido en esta conversación (ver
   * MessengerProvider) — se muestra arriba del compositor hasta el próximo
   * intento de envío. */
  sendError?: string | null;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePinMessage: (messageId: string) => void;
  /** Reacciona (o quita/cambia la reacción propia) a un mensaje. */
  onReactMessage: (messageId: string, emoji: string) => void;
  /** Abre la ficha rápida de un compañero — encabezado del chat o una
   * mención dentro de un mensaje (ver UserProfileCard, en MessengerView). */
  onOpenProfile: (userId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, user?.id]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
      if (stored) setWallpaper(stored);
    } catch {
      // localStorage no disponible (modo privado, etc.) — se ignora, queda el fondo por defecto.
    }
  }, []);

  // El menú contextual y la edición en curso son por conversación — si el
  // usuario cambia de chat con algo abierto, se cierra solo.
  useEffect(() => {
    setContextMenu(null);
    setEditingId(null);
  }, [user?.id]);

  function handleWallpaperChange(color: string | null) {
    setWallpaper(color);
    try {
      if (color) window.localStorage.setItem(WALLPAPER_STORAGE_KEY, color);
      else window.localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    } catch {
      // no-op — el cambio igual aplica en esta sesión, solo no persiste.
    }
  }

  function handleContextMenu(e: ReactMouseEvent, message: ChatMessage) {
    const isOwn = message.senderId === currentUserId;
    setContextMenu({
      messageId: message.id,
      x: e.clientX,
      y: e.clientY,
      canEdit: isOwn && !message.sticker,
      canDelete: isOwn,
      canCopy: !!(message.text || (message.sticker && !isImageSticker(message.sticker))),
      pinned: !!message.pinned,
    });
  }

  async function handleCopy(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    const content = msg?.text || msg?.sticker;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Portapapeles no disponible (permiso denegado, contexto no seguro) — se ignora en silencio,
      // no es una acción crítica.
    }
  }

  const pinnedMessage = useMemo(() => messages.find((m) => m.pinned && !m.deletedAt) ?? null, [messages]);

  function scrollToMessage(messageId: string) {
    const el = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Estado inicial de Mensajería (ningún chat seleccionado todavía) — ver
  // MessengerProvider, selectedId arranca en null a propósito, nunca en el
  // primer chat de la lista. Mismo lenguaje visual del resto del CRM (sin
  // fondo/tarjeta propios, tipografía y colores existentes) y la misma
  // animación de entrada ya usada en otros paneles (kosmo-fade-in-up,
  // definida en globals.css) — nada nuevo, solo reutilizado.
  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {/* Dos capas alineadas pixel a pixel (mismo lienzo, mismo tamaño
            renderizado): la base (astronauta + planeta + asta) queda
            estática, y encima la bandera sola ondea con una rotación
            chica sobre su propio punto de unión al asta — el resto del
            dibujo nunca se mueve. Ver globals.css (kosmo-flag-wave) y el
            recorte de las dos capas en public/brand/. */}
        <div className="animate-kosmo-fade-in-up relative h-24 aspect-[480/381]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/messenger-welcome-base.png"
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/messenger-welcome-flag.png"
            alt=""
            className="animate-kosmo-flag-wave absolute inset-0 h-full w-full object-contain"
            style={{ transformOrigin: "56.5% 12.5%" }}
          />
        </div>
        <div className="animate-kosmo-fade-in-up">
          <p className="text-sm font-semibold text-[var(--ink-primary)]">Selecciona una conversación</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Elige un chat de la lista para comenzar a conversar.
          </p>
        </div>
      </div>
    );
  }

  let lastDay = "";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenProfile(user.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenProfile(user.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenProfile(user.id);
            }
          }}
          title="Ver perfil"
          className="-m-1.5 flex min-w-0 cursor-pointer items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-hover)]"
        >
          <ChatAvatar user={user} size={38} showStatus />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">{user.name}</p>
            <p className="truncate text-xs text-[var(--ink-muted)]">
              {STATUS_LABEL[user.status]} · {user.role}
            </p>
          </div>
        </div>
        <ChatWallpaperPicker value={wallpaper} onChange={handleWallpaperChange} />
      </div>

      {pinnedMessage && (
        <button
          type="button"
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="flex shrink-0 items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--brand-50)] px-4 py-2 text-left text-xs text-[var(--brand-600)] transition-colors hover:bg-[var(--brand-50)]/70"
        >
          <Pin className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {pinnedMessage.text ||
              (pinnedMessage.sticker
                ? `${stickerPreviewGlyph(pinnedMessage.sticker)} Sticker`
                : pinnedMessage.attachments?.length
                  ? "📷 Foto"
                  : "Mensaje fijado")}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePinMessage(pinnedMessage.id);
            }}
            className="shrink-0 rounded-full p-0.5 text-[var(--brand-600)]/70 hover:bg-[var(--brand-500)]/10 hover:text-[var(--brand-600)]"
            aria-label="Desfijar mensaje"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      {/* Envuelve el área de mensajes Y el compositor en un único
          contenedor que pinta el fondo UNA sola vez — antes cada uno de los
          dos decidía por su cuenta si aplicar el color elegido o el fondo
          por defecto (la misma lógica condicional repetida en dos lugares
          distintos), y esos dos "pinceles" independientes podían quedar
          desincronizados entre sí (ver el bug reportado: mensajes en rosa,
          compositor en menta). Ahora hay un solo lugar que pinta el fondo
          — este div — y tanto el área de mensajes como ChatComposer quedan
          transparentes encima, así que es imposible que muestren colores
          distintos: literalmente comparten el mismo pixel de fondo. */}
      <div
        className={cn("flex min-h-0 flex-1 flex-col transition-colors duration-200", !wallpaper && "kosmo-chat-bg")}
        style={wallpaper ? { backgroundColor: wallpaper } : undefined}
      >
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Columna centrada con márgenes a los lados — sin esto, en una
              ventana ancha los mensajes se estiraban de punta a punta del
              panel y se perdía la sensación de "conversación", como en
              WhatsApp/Telegram de escritorio donde el chat siempre queda en
              una columna central aunque la ventana sea muy ancha. */}
          <div className="mx-auto w-full max-w-4xl space-y-3">
            {messages.length === 0 && (
              <p className="mt-10 text-center text-sm text-[var(--ink-muted)]">
                Todavía no hay mensajes. Envía el primero 👋
              </p>
            )}
            {messages.map((message) => {
              const dayLabel = formatDayLabel(message.sentAt);
              const showDaySeparator = dayLabel !== lastDay;
              lastDay = dayLabel;
              return (
                <div key={message.id} data-message-id={message.id}>
                  {showDaySeparator && (
                    <div className="my-3 flex items-center justify-center">
                      <span className="rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-[11px] font-medium text-[var(--ink-muted)]">
                        {dayLabel}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={message.senderId === currentUserId}
                    currentUserId={currentUserId}
                    onImageClick={onImageClick}
                    onContextMenu={handleContextMenu}
                    isEditing={editingId === message.id}
                    onSubmitEdit={(id, text) => {
                      onEditMessage(id, text);
                      setEditingId(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    mentionUsers={users}
                    onMentionClick={onOpenProfile}
                    onReact={onReactMessage}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {sendError && (
          <p className="shrink-0 border-t border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-[var(--status-critical)]">
            {sendError}
          </p>
        )}
        <ChatComposer onSend={onSend} mentionUsers={users} />
      </div>

      {contextMenu && (
        <MessageContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onCopy={handleCopy}
          onEdit={(id) => setEditingId(id)}
          onDelete={onDeleteMessage}
          onTogglePin={onTogglePinMessage}
        />
      )}
    </div>
  );
}
