"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  sendMessageAction,
  startConversationAction,
  markConversationReadAction,
  editMessageAction,
  deleteMessageAction,
  togglePinMessageAction,
} from "@/app/(app)/messages/actions";
import type { ChatConversation, ChatMessage, ChatUser } from "@/types";
import type { ComposerSendPayload } from "./ChatComposer";
import type { MessengerInitialData } from "@/app/(app)/messages/data";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";

interface MessengerContextValue {
  currentUser: ChatUser;
  users: ChatUser[];
  conversations: ChatConversation[];
  messagesByConv: Record<string, ChatMessage[]>;
  unreadByConv: Record<string, number>;
  totalUnread: number;
  selectedId: string | null;
  selectConversation: (id: string) => void;
  startConversation: (userId: string) => void;
  sendMessage: (payload: ComposerSendPayload) => void;
  /** Último error al enviar (validación del servidor, o la petición ni
   * siquiera llegó a correr — ej. Server Action rechazado por peso). null
   * si el último envío salió bien o todavía no se intentó ninguno. */
  sendError: string | null;
  editMessage: (messageId: string, text: string) => void;
  deleteMessage: (messageId: string) => void;
  togglePinMessage: (messageId: string) => void;
  getChatUser: (id: string) => ChatUser;
}

const MessengerContext = createContext<MessengerContextValue | null>(null);

const FALLBACK_USER_COLOR = "#898781";

export function MessengerProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: MessengerInitialData;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>(initialData.conversations);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>(initialData.messagesByConv);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>(initialData.unreadByConv);
  // Pedido explícito: nunca seleccionar automáticamente el primer chat
  // al entrar a Mensajería (antes: initialData.conversations[0]?.id ??
  // null). El estado inicial es siempre null, sin importar cuántas
  // conversaciones existan — ChatPanel ya sabía mostrar una pantalla de
  // bienvenida cuando no hay usuario seleccionado (ver el caso `!user`
  // ahí), así que este cambio es puramente de estado inicial. La única
  // forma de que se abra una conversación sigue siendo selectConversation()
  // — un clic en la lista, o el onClick de una notificación en vivo más
  // abajo — nunca un fallback automático.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  const currentUserId = initialData.currentUser.id;
  const { notify } = useNotifyToast();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const usersById = useMemo(() => {
    const map = new Map<string, ChatUser>();
    map.set(initialData.currentUser.id, initialData.currentUser);
    for (const u of initialData.users) map.set(u.id, u);
    return map;
  }, [initialData.currentUser, initialData.users]);

  // Presencia en línea — arranca con el snapshot que trajo el server
  // (ver getMessengerViewData/presence.ts) y se actualiza en vivo con los
  // eventos "presence" del SSE (abajo), así el puntito verde de cada
  // persona refleja si tiene Mensajería abierta AHORA, no si se logueó
  // en algún momento de las últimas dos semanas.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set(initialData.users.filter((u) => u.status === "ONLINE").map((u) => u.id))
  );

  function getChatUser(id: string): ChatUser {
    const base = usersById.get(id) ?? { id, name: "Usuario", role: "", avatarColor: FALLBACK_USER_COLOR, status: "OFFLINE" as const };
    if (id === currentUserId) return base; // uno mismo siempre "en línea" mientras ve la app
    return { ...base, status: onlineUserIds.has(id) ? "ONLINE" : "OFFLINE" };
  }

  function patchMessage(conversationId: string, messageId: string, patch: Partial<ChatMessage>) {
    setMessagesByConv((prev) => {
      const existing = prev[conversationId];
      if (!existing) return prev;
      return {
        ...prev,
        [conversationId]: existing.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      };
    });
  }

  // Tiempo real — una sola conexión de Server-Sent Events por sesión de
  // navegador (el provider envuelve toda la app en el layout, ver
  // AppShell.tsx), así que el badge del Sidebar y la vista de /messages
  // reciben los mensajes al instante sin recargar ni hacer polling. Ver
  // app/api/messenger/stream/route.ts — EventSource se reconecta solo si la
  // conexión se corta (comportamiento nativo del navegador).
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const source = new EventSource("/api/messenger/stream");

    source.onmessage = (evt) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (payload.type === "message") {
        const conversationId = payload.conversationId as string;
        const message = payload.message as ChatMessage;
        const participantIds = payload.participantIds as [string, string];

        setConversations((prev) => {
          if (prev.some((c) => c.id === conversationId)) return prev;
          const otherId = participantIds.find((id) => id !== currentUserId) ?? participantIds[0];
          return [{ id: conversationId, userId: otherId }, ...prev];
        });

        setMessagesByConv((prev) => {
          const existing = prev[conversationId] ?? [];
          if (existing.some((m) => m.id === message.id)) return prev; // eco de mi propio envío
          return { ...prev, [conversationId]: [...existing, message] };
        });

        if (message.senderId !== currentUserId && selectedIdRef.current !== conversationId) {
          setUnreadByConv((prev) => ({ ...prev, [conversationId]: (prev[conversationId] ?? 0) + 1 }));
        }

        // Notificación emergente — solo si el mensaje es de otra persona Y
        // el usuario no está viendo esa conversación en este mismo momento
        // (en /messages, con esa conversación puntual seleccionada). Si
        // está en otra sección del CRM, o en Mensajería pero mirando otro
        // chat, sí debe verla — ese es justo el caso que pide avisar.
        if (message.senderId !== currentUserId) {
          const isViewingThisConversation =
            pathnameRef.current === "/messages" && selectedIdRef.current === conversationId;
          if (!isViewingThisConversation) {
            const sender = getChatUser(message.senderId);
            const preview = message.text
              ? message.text
              : message.sticker
                ? "Envió un sticker"
                : message.attachments?.length
                  ? "Envió una imagen"
                  : "Nuevo mensaje";
            notify({
              type: "internal_message",
              title: sender.name,
              message: preview,
              avatarUser: sender,
              createdAt: message.sentAt,
              href: "/messages",
              onClick: () => selectConversation(conversationId),
            });
          }
        }
      } else if (payload.type === "read") {
        const conversationId = payload.conversationId as string;
        const readByUserId = payload.readByUserId as string;
        const lastReadAt = payload.lastReadAt as string;
        if (readByUserId === currentUserId) return; // mi propia marca, ya la reflejé local
        setMessagesByConv((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.senderId === currentUserId && m.sentAt <= lastReadAt ? { ...m, status: "READ" } : m
          ),
        }));
      } else if (payload.type === "message-edited") {
        const conversationId = payload.conversationId as string;
        const messageId = payload.messageId as string;
        patchMessage(conversationId, messageId, {
          text: payload.text as string,
          editedAt: payload.editedAt as string,
        });
      } else if (payload.type === "message-deleted") {
        const conversationId = payload.conversationId as string;
        const messageId = payload.messageId as string;
        patchMessage(conversationId, messageId, {
          text: undefined,
          sticker: undefined,
          attachments: undefined,
          pinned: undefined,
          deletedAt: payload.deletedAt as string,
        });
      } else if (payload.type === "presence") {
        const userId = payload.userId as string;
        const online = payload.online as boolean;
        setOnlineUserIds((prev) => {
          const has = prev.has(userId);
          if (online === has) return prev; // ya estaba en el estado correcto
          const next = new Set(prev);
          if (online) next.add(userId);
          else next.delete(userId);
          return next;
        });
      } else if (payload.type === "message-pinned") {
        const conversationId = payload.conversationId as string;
        const messageId = payload.messageId as string;
        const pinned = payload.pinned as boolean;
        setMessagesByConv((prev) => {
          const existing = prev[conversationId];
          if (!existing) return prev;
          return {
            ...prev,
            // El server solo permite un mensaje fijado a la vez por
            // conversación — al fijar uno nuevo, desfija localmente
            // cualquier otro (el server ya lo hizo, esto solo refleja el
            // mismo estado sin esperar otro evento).
            [conversationId]: existing.map((m) =>
              m.id === messageId ? { ...m, pinned } : pinned ? { ...m, pinned: false } : m
            ),
          };
        });
      }
    };

    return () => source.close();
  }, [currentUserId]);

  const totalUnread = useMemo(
    () => Object.values(unreadByConv).reduce((sum, n) => sum + n, 0),
    [unreadByConv]
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    setSendError(null);
    setUnreadByConv((prev) => ({ ...prev, [id]: 0 }));
    markConversationReadAction(id).catch(() => {});
  }

  async function startConversation(userId: string) {
    const existing = conversations.find((c) => c.userId === userId);
    if (existing) {
      selectConversation(existing.id);
      return;
    }
    const result = await startConversationAction(userId);
    if (!result.ok) return;
    const conv: ChatConversation = { id: result.conversationId, userId };
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
    setMessagesByConv((prev) => ({ ...prev, [conv.id]: prev[conv.id] ?? [] }));
    setUnreadByConv((prev) => ({ ...prev, [conv.id]: 0 }));
    selectConversation(conv.id);
  }

  async function sendMessage(payload: ComposerSendPayload) {
    if (!selectedId) return;
    const conversation = conversations.find((c) => c.id === selectedId);
    if (!conversation) return;
    const toUserId = conversation.userId;

    setSendError(null);

    // Devuelve false si el envío falló — antes esto se ignoraba en
    // silencio (el mensaje simplemente no aparecía y nadie se enteraba de
    // por qué). Ahora deja el motivo en sendError para que la UI lo muestre.
    function applyResult(result: Awaited<ReturnType<typeof sendMessageAction>>): boolean {
      if (!result.ok) {
        setSendError(result.error);
        return false;
      }
      setMessagesByConv((prev) => {
        const existing = prev[result.conversationId] ?? [];
        if (existing.some((m) => m.id === result.message.id)) return prev;
        return { ...prev, [result.conversationId]: [...existing, result.message] };
      });
      return true;
    }

    try {
      const images = payload.attachments ?? [];
      if (images.length > 0) {
        // Una fila de mensaje por imagen (el texto, si hay, viaja con la
        // primera) — conserva el envío múltiple que ya soportaba el composer.
        for (let i = 0; i < images.length; i++) {
          const result = await sendMessageAction({
            toUserId,
            text: i === 0 ? payload.text : undefined,
            imageDataUrl: images[i].url,
            imageName: images[i].name,
          });
          if (!applyResult(result)) return;
        }
        return;
      }

      const result = await sendMessageAction({ toUserId, text: payload.text, sticker: payload.sticker });
      applyResult(result);
    } catch {
      // La llamada a la Server Action ni siquiera llegó a devolver un
      // {ok:false} — ej. el body de la petición superó el límite
      // configurado en next.config.ts y Next la rechazó antes de correr
      // sendMessageAction. Sin este catch, la promesa rechazada quedaba sin
      // manejar y el envío fallaba completamente en silencio.
      setSendError("No se pudo enviar. Puede que el archivo sea muy pesado o se haya perdido la conexión.");
    }
  }

  async function editMessage(messageId: string, text: string) {
    if (!selectedId) return;
    // Optimista — se corrige solo si el server rechaza el cambio.
    const previous = messagesByConv[selectedId]?.find((m) => m.id === messageId);
    patchMessage(selectedId, messageId, { text });
    const result = await editMessageAction(messageId, text);
    if (!result.ok) {
      if (previous) patchMessage(selectedId, messageId, { text: previous.text });
      setSendError(result.error);
      return;
    }
    patchMessage(selectedId, messageId, { text: result.text, editedAt: result.editedAt });
  }

  async function deleteMessage(messageId: string) {
    if (!selectedId) return;
    const previous = messagesByConv[selectedId]?.find((m) => m.id === messageId);
    patchMessage(selectedId, messageId, {
      text: undefined,
      sticker: undefined,
      attachments: undefined,
      pinned: undefined,
      deletedAt: new Date().toISOString(),
    });
    const result = await deleteMessageAction(messageId);
    if (!result.ok && previous) {
      patchMessage(selectedId, messageId, { ...previous });
      setSendError(result.error);
    }
  }

  async function togglePinMessage(messageId: string) {
    if (!selectedId) return;
    const conv = messagesByConv[selectedId] ?? [];
    const current = conv.find((m) => m.id === messageId);
    const nextPinned = !current?.pinned;
    setMessagesByConv((prev) => {
      const existing = prev[selectedId];
      if (!existing) return prev;
      return {
        ...prev,
        [selectedId]: existing.map((m) =>
          m.id === messageId ? { ...m, pinned: nextPinned } : nextPinned ? { ...m, pinned: false } : m
        ),
      };
    });
    const result = await togglePinMessageAction(messageId);
    if (!result.ok) {
      // Revierte — no sabemos con certeza el estado previo de los demás
      // mensajes, así que simplemente deshacemos el cambio en este.
      patchMessage(selectedId, messageId, { pinned: current?.pinned });
      setSendError(result.error);
    }
  }

  const value: MessengerContextValue = {
    currentUser: initialData.currentUser,
    users: initialData.users,
    conversations,
    messagesByConv,
    unreadByConv,
    totalUnread,
    selectedId,
    selectConversation,
    startConversation,
    sendMessage,
    sendError,
    editMessage,
    deleteMessage,
    togglePinMessage,
    getChatUser,
  };

  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

export function useMessenger(): MessengerContextValue {
  const ctx = useContext(MessengerContext);
  if (!ctx) throw new Error("useMessenger debe usarse dentro de <MessengerProvider>");
  return ctx;
}
