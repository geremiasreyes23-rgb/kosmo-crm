"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishMessengerEvent } from "@/lib/messengerEvents";
import { publishNotificationEvent } from "@/lib/notificationEvents";
import { groupReactions } from "@/lib/reactions";
import { isUserOnline } from "@/lib/presence";
import type { ChatMessage, MessageReactionGroup, NotificationVM, UserQuickProfileVM } from "@/types";
import { getMessengerViewData, type MessengerInitialData } from "./data";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** El par se guarda siempre normalizado (id menor primero) para que
 * `@@unique([userAId, userBId])` detecte la conversación sin importar quién
 * de los dos la inició. */
function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function findOrCreateConversation(userId: string, otherUserId: string) {
  const [userAId, userBId] = normalizePair(userId, otherUserId);
  return prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });
}

export type SendMessageResult =
  | { ok: true; message: ChatMessage; conversationId: string }
  | { ok: false; error: string };

export async function sendMessageAction(input: {
  toUserId: string;
  text?: string;
  sticker?: string;
  imageDataUrl?: string;
  imageName?: string;
}): Promise<SendMessageResult> {
  const user = await requireUser();

  if (input.toUserId === user.id) {
    return { ok: false, error: "No puedes enviarte mensajes a ti mismo." };
  }

  const text = input.text?.trim() || undefined;
  const sticker = input.sticker || undefined;
  let imageUrl: string | undefined;
  const imageName = input.imageName;

  if (input.imageDataUrl) {
    if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(input.imageDataUrl)) {
      return { ok: false, error: "Formato de imagen inválido." };
    }
    // El data URL viene en base64 (~4/3 del tamaño real) — estimamos el peso
    // real de la imagen a partir del largo del string.
    const approxBytes = (input.imageDataUrl.length * 3) / 4;
    if (approxBytes > MAX_IMAGE_BYTES) {
      return { ok: false, error: "La imagen debe pesar menos de 3 MB." };
    }
    imageUrl = input.imageDataUrl;
  }

  if (!text && !sticker && !imageUrl) {
    return { ok: false, error: "El mensaje está vacío." };
  }

  const otherUser = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { id: true, status: true },
  });
  if (!otherUser || otherUser.status !== "ACTIVE") {
    return { ok: false, error: "Ese usuario ya no está disponible." };
  }

  const conversation = await findOrCreateConversation(user.id, input.toUserId);

  const row = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: user.id, text, sticker, imageUrl, imageName },
  });

  // Enviar un mensaje implica haber leído la conversación hasta este punto.
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId: conversation.id, userId: user.id } },
    update: { lastReadAt: row.sentAt },
    create: { conversationId: conversation.id, userId: user.id, lastReadAt: row.sentAt },
  });

  const message: ChatMessage = {
    id: row.id,
    conversationId: conversation.id,
    senderId: user.id,
    text: row.text ?? undefined,
    sticker: row.sticker ?? undefined,
    attachments: row.imageUrl
      ? [{ id: row.id, type: "IMAGE", url: row.imageUrl, name: row.imageName ?? undefined }]
      : undefined,
    sentAt: row.sentAt.toISOString(),
    status: "SENT",
  };

  publishMessengerEvent({
    type: "message",
    conversationId: conversation.id,
    participantIds: [conversation.userAId, conversation.userBId],
    message,
  });

  // Notificación en la campanita del Header para quien lo recibe — igual
  // que el correo interno (mail/actions.ts), pero sin exponer el texto real
  // del mensaje (privacidad de la conversación), solo quién escribió.
  const senderName = `${user.firstName} ${user.lastName}`;
  const notificationRow = await prisma.notification.create({
    data: {
      userId: input.toUserId,
      type: "internal_message",
      title: "Nuevo mensaje",
      message: `${senderName} te escribió`,
      relatedEntityType: "Conversation",
      relatedEntityId: conversation.id,
    },
  });
  const notificationVM: NotificationVM = {
    id: notificationRow.id,
    type: notificationRow.type,
    title: notificationRow.title,
    message: notificationRow.message,
    relatedEntityType: notificationRow.relatedEntityType ?? undefined,
    relatedEntityId: notificationRow.relatedEntityId ?? undefined,
    isRead: notificationRow.isRead,
    createdAt: notificationRow.createdAt.toISOString(),
  };
  publishNotificationEvent({ type: "notification", userId: input.toUserId, notification: notificationVM });

  return { ok: true, message, conversationId: conversation.id };
}

export async function startConversationAction(
  otherUserId: string
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (otherUserId === user.id) {
    return { ok: false, error: "No puedes chatear contigo mismo." };
  }
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { status: true } });
  if (!otherUser || otherUser.status !== "ACTIVE") {
    return { ok: false, error: "Ese usuario ya no está disponible." };
  }
  const conversation = await findOrCreateConversation(user.id, otherUserId);
  return { ok: true, conversationId: conversation.id };
}

export async function markConversationReadAction(conversationId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (!conversation || (conversation.userAId !== user.id && conversation.userBId !== user.id)) {
    return { ok: false };
  }

  const now = new Date();
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    update: { lastReadAt: now },
    create: { conversationId, userId: user.id, lastReadAt: now },
  });

  publishMessengerEvent({
    type: "read",
    conversationId,
    participantIds: [conversation.userAId, conversation.userBId],
    readByUserId: user.id,
    lastReadAt: now.toISOString(),
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Menú contextual (clic derecho) — editar / eliminar / fijar, estilo Bitrix24
// ---------------------------------------------------------------------------

export type EditMessageResult =
  | { ok: true; text: string; editedAt: string }
  | { ok: false; error: string };

export async function editMessageAction(messageId: string, text: string): Promise<EditMessageResult> {
  const user = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "El mensaje no puede quedar vacío." };

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { userAId: true, userBId: true } } },
  });
  if (!existing) return { ok: false, error: "Ese mensaje ya no existe." };
  if (existing.senderId !== user.id) return { ok: false, error: "Solo puedes editar tus propios mensajes." };
  if (existing.deletedAt) return { ok: false, error: "No se puede editar un mensaje eliminado." };
  if (existing.sticker) return { ok: false, error: "Los stickers no se pueden editar." };

  const editedAt = new Date();
  await prisma.message.update({
    where: { id: messageId },
    data: { text: trimmed, editedAt },
  });

  publishMessengerEvent({
    type: "message-edited",
    conversationId: existing.conversationId,
    participantIds: [existing.conversation.userAId, existing.conversation.userBId],
    messageId,
    text: trimmed,
    editedAt: editedAt.toISOString(),
  });

  return { ok: true, text: trimmed, editedAt: editedAt.toISOString() };
}

export type DeleteMessageResult = { ok: true } | { ok: false; error: string };

export async function deleteMessageAction(messageId: string): Promise<DeleteMessageResult> {
  const user = await requireUser();

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { userAId: true, userBId: true } } },
  });
  if (!existing) return { ok: false, error: "Ese mensaje ya no existe." };
  if (existing.senderId !== user.id) return { ok: false, error: "Solo puedes eliminar tus propios mensajes." };
  if (existing.deletedAt) return { ok: true }; // ya estaba eliminado — idempotente

  const deletedAt = new Date();
  // Si estaba fijado, se desfija al eliminarlo — no tiene sentido dejar
  // fijado un mensaje que ya no se puede leer.
  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt, pinned: false, pinnedAt: null },
  });

  publishMessengerEvent({
    type: "message-deleted",
    conversationId: existing.conversationId,
    participantIds: [existing.conversation.userAId, existing.conversation.userBId],
    messageId,
    deletedAt: deletedAt.toISOString(),
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reacciones (estilo WhatsApp/Messenger) — una sola reacción por persona y
// mensaje. Reaccionar de nuevo con el MISMO emoji la quita; con uno
// DISTINTO reemplaza la anterior (@@unique([messageId, userId]) en el
// schema, ver toggleReactionAction). No requiere ser el remitente: ambos
// participantes de la conversación pueden reaccionar a cualquier mensaje.
// ---------------------------------------------------------------------------

export type ToggleReactionResult =
  | { ok: true; reactions: MessageReactionGroup[] }
  | { ok: false; error: string };

export async function toggleReactionAction(messageId: string, emoji: string): Promise<ToggleReactionResult> {
  const user = await requireUser();

  const trimmedEmoji = emoji.trim();
  if (!trimmedEmoji) return { ok: false, error: "Emoji inválido." };

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      deletedAt: true,
      conversation: { select: { userAId: true, userBId: true } },
    },
  });
  if (!existing) return { ok: false, error: "Ese mensaje ya no existe." };
  if (existing.deletedAt) return { ok: false, error: "No se puede reaccionar a un mensaje eliminado." };
  const isParticipant = existing.conversation.userAId === user.id || existing.conversation.userBId === user.id;
  if (!isParticipant) return { ok: false, error: "No tienes acceso a esta conversación." };

  const myReaction = await prisma.messageReaction.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
  });

  if (myReaction && myReaction.emoji === trimmedEmoji) {
    // Mismo emoji que ya tenía puesto — se quita (toggle off).
    await prisma.messageReaction.delete({ where: { id: myReaction.id } });
  } else {
    // Sin reacción previa, o con una distinta — crea o reemplaza. Una sola
    // reacción por persona y mensaje, igual que Messenger/WhatsApp (no
    // "una de cada emoji" como Discord/Slack).
    await prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId: user.id } },
      update: { emoji: trimmedEmoji },
      create: { messageId, userId: user.id, emoji: trimmedEmoji },
    });
  }

  const rows = await prisma.messageReaction.findMany({
    where: { messageId },
    orderBy: { createdAt: "asc" },
    select: { emoji: true, userId: true },
  });
  const reactions = groupReactions(rows);

  publishMessengerEvent({
    type: "message-reaction",
    conversationId: existing.conversationId,
    participantIds: [existing.conversation.userAId, existing.conversation.userBId],
    messageId,
    reactions,
  });

  return { ok: true, reactions };
}

export type TogglePinResult = { ok: true; pinned: boolean } | { ok: false; error: string };

export async function togglePinMessageAction(messageId: string): Promise<TogglePinResult> {
  const user = await requireUser();

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      pinned: true,
      deletedAt: true,
      conversation: { select: { userAId: true, userBId: true } },
    },
  });
  if (!existing) return { ok: false, error: "Ese mensaje ya no existe." };
  if (existing.deletedAt) return { ok: false, error: "No se puede fijar un mensaje eliminado." };
  const isParticipant = existing.conversation.userAId === user.id || existing.conversation.userBId === user.id;
  if (!isParticipant) return { ok: false, error: "No tienes acceso a esta conversación." };

  const nextPinned = !existing.pinned;
  const pinnedAt = nextPinned ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    if (nextPinned) {
      // Un solo mensaje fijado a la vez por conversación — desfija
      // cualquier otro que ya estuviera fijado (igual que Telegram/Bitrix24).
      await tx.message.updateMany({
        where: { conversationId: existing.conversationId, pinned: true },
        data: { pinned: false, pinnedAt: null },
      });
    }
    await tx.message.update({ where: { id: messageId }, data: { pinned: nextPinned, pinnedAt } });
  });

  publishMessengerEvent({
    type: "message-pinned",
    conversationId: existing.conversationId,
    participantIds: [existing.conversation.userAId, existing.conversation.userBId],
    messageId,
    pinned: nextPinned,
    pinnedAt: pinnedAt ? pinnedAt.toISOString() : null,
  });

  return { ok: true, pinned: nextPinned };
}


// ---------------------------------------------------------------------------
// Ficha rápida de perfil — clic/clic derecho sobre la foto o el nombre de un
// compañero en Mensajería (encabezado del chat, lista de conversaciones o
// una mención dentro de un mensaje). Cualquier usuario activo puede verla —
// mismo criterio "todos con todos" que ya rige quién puede chatear con
// quién (ver getMessengerViewData) — y solo expone datos de directorio de
// trabajo, nunca información sensible.
// ---------------------------------------------------------------------------

export type UserQuickProfileResult =
  | { ok: true; profile: UserQuickProfileVM }
  | { ok: false; error: string };

/** Igual que formatBirthdayShort en profile/data.ts — se repite acá (en vez
 * de exportarla desde allá) para no acoplar este archivo a esa página; es
 * una función chica y sin estado. */
function formatBirthdayShort(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

export async function getUserQuickProfileAction(userId: string): Promise<UserQuickProfileResult> {
  await requireUser();

  // Presencia real por conexión SSE (ver src/lib/presence.ts) — NO
  // "¿tiene una sesión sin vencer?" (una sesión dura hasta 14 días, ver
  // SESSION_TTL_DAYS en auth.ts): con eso, cualquiera que se hubiera
  // logueado en las últimas dos semanas aparecía "En línea" para siempre
  // acá, aunque hubiera cerrado la pestaña hace días (bug real reportado:
  // esta ficha rápida se había quedado con el chequeo viejo mientras el
  // resto de Mensajería ya usaba la presencia real).
  const [row, recognitionGroups] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, supervisor: { select: { firstName: true, lastName: true } } },
    }),
    prisma.recognition.groupBy({ by: ["type"], where: { toUserId: userId }, _count: true }),
  ]);

  if (!row || row.status !== "ACTIVE") {
    return { ok: false, error: "Ese usuario ya no está disponible." };
  }

  const recognitionCounts = recognitionGroups
    .filter((g) => g._count > 0)
    .map((g) => ({ type: g.type as string, count: g._count }));

  const profile: UserQuickProfileVM = {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    roleName: row.role.name,
    jobTitle: row.jobTitle,
    department: row.department,
    email: row.email,
    phone: row.phoneExtension ?? row.phone,
    avatarUrl: row.avatarUrl,
    coverPhotoUrl: row.coverPhotoUrl,
    city: row.city,
    status: isUserOnline(userId) ? "ONLINE" : "OFFLINE",
    supervisorName: row.supervisor ? `${row.supervisor.firstName} ${row.supervisor.lastName}` : null,
    birthdayLabel: formatBirthdayShort(row.birthday),
    notificationLanguage: row.notificationLanguage,
    workFormat: row.workFormat,
    recognitionCounts,
  };

  return { ok: true, profile };
}

/**
 * Historial completo del chat (roster con avatares + todos los mensajes con
 * sus imágenes) — se pide UNA sola vez desde el cliente al montar
 * MessengerProvider, no en cada navegación (ver comentario en
 * getMessengerBadgeData, data.ts). Los datos livianos para el badge del
 * Sidebar siguen viniendo del layout en cada carga; esto es deliberadamente
 * lo único "pesado" del chat, y ahora se paga una sola vez por sesión de
 * navegador en vez de una vez por click en el menú.
 */
export async function getMessengerFullDataAction(): Promise<MessengerInitialData> {
  const user = await requireUser();
  return getMessengerViewData(user);
}
