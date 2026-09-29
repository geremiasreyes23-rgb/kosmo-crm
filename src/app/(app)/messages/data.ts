import "server-only";

import { prisma } from "@/lib/db";
import { avatarColorFromId } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { getOnlineUserIds } from "@/lib/presence";
import { groupReactions } from "@/lib/reactions";
import type { ChatConversation, ChatMessage, ChatUser } from "@/types";

export interface MessengerInitialData {
  currentUser: ChatUser;
  /** Todos los demás usuarios ACTIVE de la plataforma — "todos con todos",
   * cualquiera puede iniciar un chat con cualquiera, sin restricción de
   * jerarquía/rol. */
  users: ChatUser[];
  conversations: ChatConversation[];
  messagesByConv: Record<string, ChatMessage[]>;
  unreadByConv: Record<string, number>;
}

function toChatUser(row: {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: { name: string };
}, online: boolean): ChatUser {
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    role: row.role.name,
    avatarColor: avatarColorFromId(row.id),
    avatarUrl: row.avatarUrl ?? undefined,
    status: online ? "ONLINE" : "OFFLINE",
  };
}

/**
 * Arma todo lo que necesita el chat interno en una sola función — se llama
 * desde el layout de (app) (igual que getProfileViewData) para que el
 * badge de no-leídos del Sidebar esté disponible en cualquier página, no
 * solo en /messages. Reemplaza por completo los datos ficticios de
 * src/data/messenger.ts (Fase 1): conversaciones, mensajes y usuarios ahora
 * son filas reales compartidas entre todos los que entran a la plataforma.
 */
/**
 * Versión liviana de arriba — se llama desde el layout de (app) en CADA
 * navegación (para que el badge de no-leídos del Sidebar esté siempre al
 * día), así que NO puede traer mensajes completos ni imágenes: eso fue
 * justo lo que generó el consumo de red desproporcionado en Neon (ver
 * incidente de egress de sep/2026) — `getMessengerViewData` de arriba trae
 * TODO el historial con imágenes en base64, y se estaba llamando en cada
 * carga de cualquier página del CRM, no solo de /messages.
 *
 * Esta versión solo cuenta mensajes no leídos por conversación (un COUNT
 * chico por conversación, nunca el contenido) y devuelve el par
 * id/otherUserId de cada conversación — lo mínimo que necesita el Sidebar.
 * El historial completo (mensajes, imágenes, roster con avatares) se pide
 * una sola vez desde el cliente, al montar MessengerProvider — ver
 * getMessengerFullDataAction en actions.ts y el useEffect en
 * MessengerProvider.tsx — no en cada navegación.
 */
export interface MessengerBadgeData {
  conversations: { id: string; userId: string }[];
  unreadByConv: Record<string, number>;
}

export async function getMessengerBadgeData(sessionUser: SessionUser): Promise<MessengerBadgeData> {
  const myConversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: sessionUser.id }, { userBId: sessionUser.id }] },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      reads: { where: { userId: sessionUser.id }, select: { lastReadAt: true } },
    },
  });

  const conversations = myConversations.map((c) => ({
    id: c.id,
    userId: c.userAId === sessionUser.id ? c.userBId : c.userAId,
  }));

  const unreadByConv: Record<string, number> = {};
  await Promise.all(
    myConversations.map(async (c) => {
      const myLastReadAt = c.reads[0]?.lastReadAt ?? new Date(0);
      unreadByConv[c.id] = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: sessionUser.id },
          sentAt: { gt: myLastReadAt },
          deletedAt: null,
        },
      });
    })
  );

  return { conversations, unreadByConv };
}

export async function getMessengerViewData(sessionUser: SessionUser): Promise<MessengerInitialData> {
  const [allUsers, myConversations] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      include: { role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.conversation.findMany({
      where: { OR: [{ userAId: sessionUser.id }, { userBId: sessionUser.id }] },
      include: {
        messages: { orderBy: { sentAt: "asc" }, include: { reactions: true } },
        reads: true,
      },
    }),
  ]);

  // "En línea" = tiene una conexión de Mensajería realmente abierta ahora
  // (ver src/lib/presence.ts) — antes esto salía de `prisma.session`
  // (¿tiene una sesión sin vencer, de hasta 14 días?), así que cualquiera
  // que se hubiera logueado esa misma quincena aparecía en línea para
  // siempre, estuviera conectado o no.
  const onlineIds = getOnlineUserIds();
  const meRow = allUsers.find((u) => u.id === sessionUser.id);

  const users: ChatUser[] = allUsers
    .filter((u) => u.id !== sessionUser.id)
    .map((u) => toChatUser(u, onlineIds.has(u.id)));

  const currentUser: ChatUser = meRow
    ? toChatUser(meRow, true)
    : {
        id: sessionUser.id,
        name: `${sessionUser.firstName} ${sessionUser.lastName}`,
        role: sessionUser.roleName,
        avatarColor: avatarColorFromId(sessionUser.id),
        avatarUrl: sessionUser.avatarUrl ?? undefined,
        status: "ONLINE",
      };

  const conversations: ChatConversation[] = [];
  const messagesByConv: Record<string, ChatMessage[]> = {};
  const unreadByConv: Record<string, number> = {};

  for (const conv of myConversations) {
    const otherUserId = conv.userAId === sessionUser.id ? conv.userBId : conv.userAId;
    conversations.push({ id: conv.id, userId: otherUserId });

    const myRead = conv.reads.find((r) => r.userId === sessionUser.id);
    const otherRead = conv.reads.find((r) => r.userId === otherUserId);
    const myLastReadAt = myRead?.lastReadAt ?? new Date(0);
    const otherLastReadAt = otherRead?.lastReadAt ?? new Date(0);

    messagesByConv[conv.id] = conv.messages.map((m) => ({
      id: m.id,
      conversationId: conv.id,
      senderId: m.senderId,
      // Un mensaje eliminado no manda su contenido original al cliente —
      // ni siquiera a quien lo escribió — la UI solo muestra "Mensaje
      // eliminado" a partir de deletedAt.
      text: m.deletedAt ? undefined : m.text ?? undefined,
      sticker: m.deletedAt ? undefined : m.sticker ?? undefined,
      attachments:
        !m.deletedAt && m.imageUrl
          ? [{ id: m.id, type: "IMAGE" as const, url: m.imageUrl, name: m.imageName ?? undefined }]
          : undefined,
      sentAt: m.sentAt.toISOString(),
      status: m.senderId === sessionUser.id ? (m.sentAt <= otherLastReadAt ? "READ" : "SENT") : undefined,
      editedAt: m.editedAt ? m.editedAt.toISOString() : undefined,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : undefined,
      pinned: m.pinned || undefined,
      // Igual que text/sticker arriba: un mensaje eliminado no manda sus
      // reacciones al cliente (la burbuja ni siquiera las muestra).
      reactions:
        m.deletedAt || m.reactions.length === 0 ? undefined : groupReactions(m.reactions),
    }));

    unreadByConv[conv.id] = conv.messages.filter(
      (m) => m.senderId !== sessionUser.id && m.sentAt > myLastReadAt
    ).length;
  }

  // Más reciente primero, igual que el orden que ya tenía el shell mock.
  conversations.sort((a, b) => {
    const aLast = messagesByConv[a.id].at(-1)?.sentAt ?? "";
    const bLast = messagesByConv[b.id].at(-1)?.sentAt ?? "";
    return bLast.localeCompare(aLast);
  });

  return { currentUser, users, conversations, messagesByConv, unreadByConv };
}
