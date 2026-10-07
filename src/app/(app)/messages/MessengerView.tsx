"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ConversationList, type ConversationSummary } from "@/components/messenger/ConversationList";
import { ChatPanel } from "@/components/messenger/ChatPanel";
import { NewChatModal } from "@/components/messenger/NewChatModal";
import { UserProfileCard } from "@/components/messenger/UserProfileCard";
import { useMessenger } from "@/components/messenger/MessengerProvider";
import { OverlayPortal, useScrollLock } from "@/components/ui/Overlay";

export function MessengerView() {
  const {
    currentUser,
    users,
    conversations,
    messagesByConv,
    unreadByConv,
    selectedId,
    selectConversation,
    startConversation,
    sendMessage,
    sendError,
    editMessage,
    deleteMessage,
    togglePinMessage,
    reactToMessage,
    getChatUser,
  } = useMessenger();

  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  useScrollLock(!!lightboxUrl);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const summaries: ConversationSummary[] = useMemo(() => {
    const rows = conversations.map((conversation) => {
      const msgs = messagesByConv[conversation.id] ?? [];
      return {
        conversation,
        user: getChatUser(conversation.userId),
        lastMessage: msgs[msgs.length - 1],
        unread: unreadByConv[conversation.id] ?? 0,
      };
    });
    const filtered = search.trim()
      ? rows.filter((r) => r.user.name.toLowerCase().includes(search.trim().toLowerCase()))
      : rows;
    return filtered.sort((a, b) => {
      if (!!a.conversation.pinned !== !!b.conversation.pinned) {
        return a.conversation.pinned ? -1 : 1;
      }
      const aTime = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, messagesByConv, unreadByConv, search]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedUser = selectedConversation ? getChatUser(selectedConversation.userId) : null;
  const selectedMessages = selectedId ? messagesByConv[selectedId] ?? [] : [];

  // La conversación DEL PERFIL que se está mostrando — no necesariamente
  // la seleccionada: se puede abrir este panel con clic derecho desde la
  // lista de conversaciones sin cambiar de chat activo (ver
  // ConversationList, onViewProfile). De acá salen los archivos
  // compartidos, la búsqueda y el silenciado del panel de contacto.
  const profileConversation = profileUserId
    ? conversations.find((c) => c.userId === profileUserId) ?? null
    : null;
  const profileMessages = profileConversation ? messagesByConv[profileConversation.id] ?? [] : [];

  const usersWithoutConversation = users.filter(
    (u) => !conversations.some((c) => c.userId === u.id)
  );

  function handleSelect(id: string) {
    selectConversation(id);
    setMobileShowChat(true);
  }

  function handlePick(userId: string) {
    startConversation(userId);
    setNewChatOpen(false);
    setMobileShowChat(true);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sin PageHeader — Mensajes ocupa todo el alto disponible, como un
          panel de chat de verdad, en vez de dejarle un título/descripción
          arriba como el resto de las páginas. "Nuevo chat" sigue estando,
          ahora solo desde el ícono junto al buscador (ver ConversationList),
          que ya hacía exactamente lo mismo. Sin borde/rounded/sombra propios
          ni padding del layout (ver MainFrame) — el panel de chat cubre el
          <main> completo, a borde a borde, en vez de flotar como una tarjeta
          con un marco blanco alrededor. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[var(--surface-card)]">
        <div className={mobileShowChat ? "hidden md:flex md:h-full" : "flex h-full w-full md:w-auto md:flex"}>
          <ConversationList
            items={summaries}
            selectedId={selectedId}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            onNewChat={() => setNewChatOpen(true)}
            currentUserId={currentUser.id}
            onViewProfile={setProfileUserId}
          />
        </div>

        <div className={mobileShowChat ? "flex h-full w-full flex-col md:w-auto md:flex-1" : "hidden md:flex md:h-full md:flex-1"}>
          {mobileShowChat && (
            <button
              type="button"
              onClick={() => setMobileShowChat(false)}
              className="border-b border-[var(--border-hairline)] px-4 py-2 text-left text-xs font-medium text-[var(--brand-600)] md:hidden"
            >
              ← Conversaciones
            </button>
          )}
          <ChatPanel
            user={selectedUser}
            messages={selectedMessages}
            currentUserId={currentUser.id}
            users={users}
            onSend={sendMessage}
            onImageClick={setLightboxUrl}
            sendError={sendError}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onTogglePinMessage={togglePinMessage}
            onReactMessage={reactToMessage}
            onOpenProfile={setProfileUserId}
          />
        </div>

        <UserProfileCard
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          currentUserId={currentUser.id}
          conversationId={profileConversation?.id ?? null}
          messages={profileMessages}
          onImageClick={setLightboxUrl}
        />
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        availableUsers={usersWithoutConversation}
        onPick={handlePick}
      />

      {lightboxUrl && (
        <OverlayPortal>
        <div
          className="animate-kosmo-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Vista ampliada"
            className="animate-kosmo-fade-in-scale max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        </OverlayPortal>
      )}
    </div>
  );
}
