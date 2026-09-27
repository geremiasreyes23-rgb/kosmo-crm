"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/(app)/notifications/actions";
import { playSound } from "@/lib/sounds";
import { notificationHref } from "@/lib/notificationMeta";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";
import type { NotificationVM } from "@/types";
import type { NotificationInitialData } from "@/app/(app)/notifications/data";

/** Mensajes de Mensajería NO reproducen sonido acá — lo decide
 * MessengerProvider, que es el único lugar que sabe si el usuario ya está
 * viendo esa conversación puntual ahora mismo (para elegir entre el sonido
 * normal y el más discreto de "chat activo"). Reproducirlo también acá
 * duplicaría el sonido del mismo evento. Todo lo demás (tareas, citas,
 * Turning 65, correo interno) usa el sonido de notificación genérica — ver
 * src/lib/sounds.ts. */
function shouldPlaySoundHere(type: string): boolean {
  return type !== "internal_message";
}

interface NotificationContextValue {
  notifications: NotificationVM[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: NotificationInitialData;
}) {
  const [notifications, setNotifications] = useState<NotificationVM[]>(initialData.notifications);
  const [unreadCount, setUnreadCount] = useState(initialData.unreadCount);
  const { notify } = useNotifyToast();

  // Tiempo real — misma idea que MessengerProvider: una sola conexión SSE
  // por pestaña, ver app/api/notifications/stream/route.ts.
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const source = new EventSource("/api/notifications/stream");

    source.onmessage = (evt) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (payload.type === "notification") {
        const notification = payload.notification as NotificationVM;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          return [notification, ...prev].slice(0, 30);
        });
        setUnreadCount((prev) => prev + 1);
        if (shouldPlaySoundHere(notification.type)) playSound("notification");

        // Notificación emergente — los mensajes de Mensajería ya se
        // muestran (con foto y el texto real) desde MessengerProvider, que
        // escucha su propio stream de mensajes en tiempo real; mostrarla
        // también acá duplicaría el aviso para el mismo mensaje.
        if (notification.type !== "internal_message") {
          notify({
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt,
            href: notificationHref(notification),
          });
        }
      } else if (payload.type === "read") {
        const notificationId = payload.notificationId as string | undefined;
        if (notificationId) {
          setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
        } else {
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        }
        setUnreadCount(0);
      }
    };

    return () => source.close();
  }, []);

  function markRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    markNotificationReadAction(id).catch(() => {});
  }

  function markAllRead() {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    markAllNotificationsReadAction().catch(() => {});
  }

  const value: NotificationContextValue = { notifications, unreadCount, markRead, markAllRead };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de <NotificationProvider>");
  return ctx;
}
