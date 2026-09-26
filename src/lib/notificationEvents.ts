import "server-only";
import { EventEmitter } from "events";
import type { NotificationVM } from "@/types";

/**
 * Bus de eventos en memoria para notificaciones en tiempo real — mismo
 * patrón que src/lib/messengerEvents.ts (ver los comentarios ahí para el
 * porqué del singleton en `globalThis` y la limitación de una sola
 * instancia de Node). Cuando se crea una notificación (server action, o el
 * scheduler de src/lib/notificationScheduler.ts) se publica acá, y
 * app/api/notifications/stream/route.ts la reenvía de inmediato a las
 * pestañas abiertas de ESE usuario.
 */
const globalForNotifications = globalThis as unknown as { notificationEvents?: EventEmitter };

export const notificationEvents = globalForNotifications.notificationEvents ?? new EventEmitter();
notificationEvents.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForNotifications.notificationEvents = notificationEvents;
}

export interface NotificationCreatedEvent {
  type: "notification";
  userId: string;
  notification: NotificationVM;
}

export interface NotificationReadEvent {
  type: "read";
  userId: string;
  /** undefined = se marcaron todas como leídas de una vez. */
  notificationId?: string;
}

export type NotificationEvent = NotificationCreatedEvent | NotificationReadEvent;

const CHANNEL = "notifications";

export function publishNotificationEvent(event: NotificationEvent) {
  notificationEvents.emit(CHANNEL, event);
}

export function subscribeNotificationEvents(listener: (event: NotificationEvent) => void): () => void {
  notificationEvents.on(CHANNEL, listener);
  return () => notificationEvents.off(CHANNEL, listener);
}
