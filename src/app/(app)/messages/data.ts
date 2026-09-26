import "server-only";

import { prisma } from "@/lib/db";
import { avatarColorFromId } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import { getOnlineUserIds } from "@/lib/presence";
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
        messages: { orderBy: { sentAt: "asc" } },
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
