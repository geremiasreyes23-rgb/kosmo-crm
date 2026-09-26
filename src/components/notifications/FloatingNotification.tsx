"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ChatAvatar } from "@/components/messenger/ChatAvatar";
import { notificationTypeMeta } from "@/lib/notificationMeta";
import { formatRelativeTime } from "@/lib/utils";
import type { ToastInput } from "./ToastNotificationProvider";

/** Duración de la animación de entrada/salida — debe coincidir con la
 * clase `duration-[420ms]` de abajo; se usa acá para saber cuánto esperar
 * antes de desmontar de verdad tras iniciar la salida. */
const EXIT_MS = 420;

export function FloatingNotification({
  toast,
  onClose,
  onActivate,
}: {
  toast: ToastInput & { id: string; createdAt: string; duration: number };
  onClose: () => void;
  onActivate: () => void;
}) {
  // Arranca fuera de pantalla (arriba, invisible) y al frame siguiente pasa
  // a "shown" — ese cambio de clase es lo que dispara la transición CSS de
  // entrada (deslizar hacia abajo + fade in), en vez de aparecer de golpe.
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    autoDismissRef.current = setTimeout(startLeave, toast.duration);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startLeave() {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setLeaving(true);
    leaveTimeoutRef.current = setTimeout(onClose, EXIT_MS);
  }

  const meta = notificationTypeMeta(toast.type);
  const Icon = meta.icon;

  // "Ahora" para lo recién llegado (formatRelativeTime ya devuelve "Justo
  // ahora" para los primeros ~30s) y después la hora relativa normal.
  const timeLabel = formatRelativeTime(toast.createdAt).replace("Justo ahora", "Ahora");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate();
      }}
      className="pointer-events-auto w-[calc(100vw-24px)] max-w-[460px] cursor-pointer overflow-hidden rounded-[18px] border border-[var(--border-hairline)] bg-[var(--surface-card)]/90 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[460px]"
      style={{
        transform: shown && !leaving ? "translateY(0)" : "translateY(-120%)",
        opacity: shown && !leaving ? 1 : 0,
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {toast.avatarUser ? (
          <ChatAvatar user={toast.avatarUser} size={40} />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${meta.accent}26` }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color: meta.accent }} />
          </span>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-semibold text-[var(--ink-primary)]">{toast.title}</p>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.accent }} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--ink-secondary)]">{toast.message}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{timeLabel}</p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            startLeave();
          }}
          aria-label="Cerrar notificación"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
