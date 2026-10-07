"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useScrollLock } from "./Overlay";

/**
 * Ventana de aplicación grande centrada sobre el contenido actual — a
 * diferencia de `Modal` (diálogo chico centrado, para formularios cortos y
 * confirmaciones) o `Drawer` (panel angosto que se desliza desde el borde),
 * este componente ocupa la mayor parte de la pantalla. Se usa para vistas
 * "de página completa" (como el perfil de usuario) que NO deben interrumpir
 * la navegación real: el Dashboard sigue montado y visible detrás, solo
 * queda oscurecido y bloqueado para scroll mientras está abierto.
 *
 * Mismo patrón de montaje/animación que Drawer (portal a <body>, doble
 * requestAnimationFrame para que el estado inicial se pinte antes de animar
 * hacia el estado abierto — si no, el navegador puede fusionar ambos
 * estados en una sola pintada y la transición de entrada nunca se ve).
 */
export function AppWindowModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    let raf1: number;
    let raf2: number;
    let timeout: ReturnType<typeof setTimeout>;
    if (open) {
      setMounted(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEntered(true));
      });
    } else {
      setEntered(false);
      timeout = setTimeout(() => setMounted(false), 200);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timeout);
    };
  }, [open]);

  // El Dashboard de atrás no debe poder desplazarse mientras el modal está
  // abierto — si no, se alcanza a hacer scroll "a través" del overlay.
  // (Antes solo se bloqueaba <body>, pero el scroll real de la página vive
  // en el panel principal — useScrollLock bloquea ambos.)
  useScrollLock(open);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 lg:p-10">
      <div
        className={cn(
          "absolute inset-0 bg-black/35 transition-opacity duration-200 ease-out",
          entered ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-[var(--surface-card)] shadow-2xl transition-all duration-200 ease-out",
          "sm:h-[92vh] sm:w-[94vw] sm:rounded-2xl",
          "lg:h-[90vh] lg:w-[88vw] lg:max-w-[1400px]",
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}
