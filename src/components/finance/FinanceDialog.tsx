"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { OVERLAY_MAX_HEIGHT, OVERLAY_TOP_CLASSES, OverlayPortal, useScrollLock } from "@/components/ui/Overlay";

/** Ventana modal del Control Financiero — mismo lenguaje visual que el
 * modal de Reporte diario (tarjeta amplia, encabezado con ícono, pie fijo). */
export function FinanceDialog({
  open,
  onClose,
  icon,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  width?: string;
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
      className={`animate-kosmo-fade-in z-[60] bg-black/45 backdrop-blur-[2px] ${OVERLAY_TOP_CLASSES}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-kosmo-fade-in-scale flex w-full ${width} flex-col overflow-hidden rounded-2xl bg-[var(--surface-card)] shadow-2xl ${OVERLAY_MAX_HEIGHT}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
              {icon}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          {footer}
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
      {children}
      {required && <span className="ml-0.5 text-[var(--status-critical)]">*</span>}
    </span>
  );
}

export function FieldError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[11px] font-medium text-[var(--status-critical)]">{text}</p> : null;
}
