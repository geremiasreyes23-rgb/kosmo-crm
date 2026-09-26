import "server-only";

import { prisma } from "@/lib/db";
import type { NotificationVM } from "@/types";

export interface NotificationInitialData {
  notifications: NotificationVM[];
  unreadCount: number;
}

const MAX_NOTIFICATIONS = 30;

/**
 * Arma lo que necesita la campanita del Header — se llama desde el layout
 * de (app), igual que getMessengerViewData, para que el contador de
 * no-leídas esté disponible apenas carga cualquier página.
 */
export async function getNotificationsForUser(userId: string): Promise<NotificationInitialData> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_NOTIFICATIONS,
  });

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  const notifications: NotificationVM[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedEntityType: n.relatedEntityType ?? undefined,
    relatedEntityId: n.relatedEntityId ?? undefined,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return { notifications, unreadCount };
}
