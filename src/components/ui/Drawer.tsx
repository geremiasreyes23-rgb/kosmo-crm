"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Panel lateral deslizante (estilo Bitrix24) — se usa para crear/editar
 * registros sin sacar al usuario de la pantalla en la que está, a diferencia
 * de un modal centrado que interrumpe el contexto. Anima tanto la entrada
 * como la salida (se queda montado unos ms extra al cerrar para poder
 * reproducir la transición de salida antes de desmontarse).
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-lg",
  edgeClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /**
   * Cuando es `true`, oculta la X de la barra de título y en su lugar
   * dibuja un botón circular flotante ("muesca") pegado al borde
   * izquierdo del panel — pedido puntual del panel de perfil para que la X
   * no compita visualmente con el título. El resto de los Drawer de la app
   * no pasan esta prop, así que su comportamiento no cambia.
   */
  edgeClose?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  // El drawer se monta vía portal directo a <body>: si se renderiza en el
  // árbol normal, cualquier ancestro con una animación/transform activa
  // (por ejemplo el fade-in de las pestañas en Tabs, o una tarjeta del
  // Kanban) crea un "containing block" nuevo y `position: fixed` deja de
  // posicionarse contra el viewport — el panel se ve encogido y cortado en
  // vez de ocupar toda la altura de la pantalla. El portal evita ese
  // problema por completo, sin importar dónde se use el Drawer.
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
      // Doble rAF: si el panel se acaba de montar, el navegador puede
      // "coalescer" el estado cerrado (translate-x-full) y el abierto
      // (translate-x-0) en una sola pintada cuando ambos se piden dentro
      // del mismo frame — el resultado es que nunca se ve el estado inicial
      // y por lo tanto no hay transición visible. Esperar dos rAF garantiza
      // que el navegador ya pintó el estado "cerrado" al menos una vez antes
      // de pedir el estado "abierto", así que la transición sí se reproduce.
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity duration-200 ease-out",
          entered ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          `relative flex h-full w-full ${width} flex-col bg-[var(--surface-card)] shadow-2xl transition-transform duration-200 ease-out`,
          entered ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Muesca de cierre pegada al borde izquierdo del panel — vive como
            hijo directo del panel (no del contenedor con overflow-y-auto de
            abajo) para que no la recorte el overflow-x implícito que aplica
            la spec de CSS cuando solo se fija overflow-y, y para que se
            mueva junto con el panel en la transición de translate-x. */}
        {edgeClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute -left-5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)] shadow-lg transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
        <div className="flex items-start justify-between border-b border-[var(--border-hairline)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink-primary)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>}
          </div>
          {!edgeClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              aria-label="Cerrar"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
