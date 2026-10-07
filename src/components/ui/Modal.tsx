"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { OVERLAY_MAX_HEIGHT, OVERLAY_TOP_CLASSES, OverlayPortal, useScrollLock } from "./Overlay";

/**
 * Diálogo para formularios cortos y confirmaciones. Siempre aparece ARRIBA
 * de la pantalla (no a mitad del contenido) y, mientras está abierto, la
 * página de atrás no se puede desplazar — ver ./Overlay.tsx.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <OverlayPortal>
      <div
        className={`animate-kosmo-fade-in z-50 bg-black/40 backdrop-blur-[2px] ${OVERLAY_TOP_CLASSES}`}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={`animate-kosmo-fade-in-scale flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[var(--surface-card)] shadow-xl ${OVERLAY_MAX_HEIGHT}`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        </div>
      </div>
    </OverlayPortal>
  );
}
