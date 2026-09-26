"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ChatUser } from "@/types";
import { FloatingNotification } from "./FloatingNotification";

/** Máximo de notificaciones emergentes visibles a la vez — el resto espera
 * en cola y va entrando a medida que las visibles se cierran (ver
 * MAX_VISIBLE más abajo). */
const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 5000;

export interface ToastInput {
  /** Tipo de evento — usa los mismos strings que NotificationVM.type
   * (internal_message, task_overdue, turning_65, etc.) más los que todavía
   * no tienen disparador en el backend (new_client, new_lead...) — ver
   * src/lib/notificationMeta.ts. Solo decide el ícono/color por defecto
   * cuando no hay `avatarUser`. */
  type: string;
  title: string;
  message: string;
  /** Si viene, se muestra la foto/iniciales de esta persona en vez del
   * ícono genérico del tipo — así se ven mensajes nuevos con la cara real
   * de quien escribió, igual que pide el diseño tipo Samsung. */
  avatarUser?: ChatUser;
  /** ISO — para el "hace unos segundos" / "Ahora". Por defecto, el momento
   * en que se llama a notify(). */
  createdAt?: string;
  /** Ruta a la que navega al hacer click. Si se pasa `onClick`, ese corre
   * primero (ej. seleccionar la conversación) y después se navega igual. */
  href?: string;
  onClick?: () => void;
  /** ms visible antes de autodescartarse. */
  duration?: number;
}

interface ActiveToast extends ToastInput {
  id: string;
  createdAt: string;
  duration: number;
}

interface ToastContextValue {
  notify: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

export function ToastNotificationProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<ActiveToast[]>([]);
  const queueRef = useRef<ActiveToast[]>([]);
  const router = useRouter();

  const promote = useCallback(() => {
    setVisible((prev) => {
      if (prev.length >= MAX_VISIBLE) return prev;
      const next = queueRef.current.shift();
      if (!next) return prev;
      return [...prev, next];
    });
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setVisible((prev) => prev.filter((t) => t.id !== id));
      queueRef.current = queueRef.current.filter((t) => t.id !== id);
      // Deja que se acomode el stack y recién ahí promueve el siguiente de
      // la cola (si no, el que entra "salta" en vez de deslizarse solo).
      setTimeout(promote, 80);
    },
    [promote]
  );

  const notify = useCallback(
    (input: ToastInput): string => {
      toastSeq += 1;
      const id = `toast-${Date.now()}-${toastSeq}`;
      const toast: ActiveToast = {
        ...input,
        id,
        createdAt: input.createdAt ?? new Date().toISOString(),
        duration: input.duration ?? DEFAULT_DURATION_MS,
      };
      setVisible((prev) => {
        if (prev.length < MAX_VISIBLE) return [...prev, toast];
        queueRef.current.push(toast);
        return prev;
      });
      return id;
    },
    []
  );

  function handleActivate(toast: ActiveToast) {
    toast.onClick?.();
    if (toast.href && toast.href !== "#") router.push(toast.href);
    dismiss(toast.id);
  }

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      {/* Contenedor global, fijo por encima de todo (ver z-index) — el
          propio contenedor no bloquea clicks (pointer-events-none), solo
          las tarjetas individuales los reciben, así nunca tapa el resto de
          la interfaz aunque esté "vacío" en el resto del ancho/alto. */}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] flex flex-col items-end gap-2.5 sm:inset-x-auto sm:right-6 sm:top-5">
        {visible.map((toast) => (
          <FloatingNotification
            key={toast.id}
            toast={toast}
            onClose={() => dismiss(toast.id)}
            onActivate={() => handleActivate(toast)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useNotifyToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useNotifyToast debe usarse dentro de <ToastNotificationProvider>");
  return ctx;
}
