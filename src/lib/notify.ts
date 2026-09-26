import "server-only";

import { prisma } from "./db";
import { publishNotificationEvent } from "./notificationEvents";
import type { NotificationVM } from "@/types";

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Crea una Notification y la publica en tiempo real (campanita del Header +
 * notificación emergente) — mismo patrón ya usado en mail/actions.ts y
 * messages/actions.ts, extraído acá para reusarlo desde Reportes diarios
 * sin duplicar el bloque de nuevo.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    },
  });
  const notification: NotificationVM = {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.relatedEntityType ?? undefined,
    relatedEntityId: row.relatedEntityId ?? undefined,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
  publishNotificationEvent({ type: "notification", userId: input.userId, notification });
}
