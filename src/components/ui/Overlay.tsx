"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Piezas compartidas por TODAS las ventanas emergentes (Modal, Drawer,
 * diálogos del Control Financiero, Reporte diario, correo, tema...):
 *
 *  - <OverlayPortal>: monta la ventana directamente en <body>. Si se queda
 *    dentro del contenido de la página, cualquier ancestro con animación o
 *    transform hace que `position: fixed` deje de pegarse a la pantalla y
 *    la ventana aparece a mitad del contenido (había que bajar con el scroll
 *    para encontrarla).
 *  - useScrollLock(): mientras hay una ventana abierta, la página de atrás
 *    no se puede desplazar. Bloquea el <body> y el panel principal con
 *    scroll propio (MainFrame, marcado con data-scroll-container).
 *
 * Las ventanas se alinean ARRIBA de la pantalla (OVERLAY_TOP_CLASSES) para
 * que el formulario quede a la vista sin tener que buscarlo.
 */

/** Clases del contenedor de una ventana alineada arriba. */
export const OVERLAY_TOP_CLASSES =
  "fixed inset-0 flex items-start justify-center overflow-hidden px-3 pb-3 pt-[3vh] sm:px-6 sm:pt-[6vh]";

/** Alto máximo de la ventana: el resto de la pantalla bajo el margen superior. */
export const OVERLAY_MAX_HEIGHT = "max-h-[94vh] sm:max-h-[88vh]";

let lockCount = 0;
const saved = new Map<HTMLElement, string>();

function lockTargets(): HTMLElement[] {
  return [document.body, ...Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-container]"))];
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      for (const el of lockTargets()) {
        saved.set(el, el.style.overflow);
        el.style.overflow = "hidden";
      }
    }
    lockCount++;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        for (const [el, prev] of saved) el.style.overflow = prev;
        saved.clear();
      }
    };
  }, [active]);
}

export function OverlayPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}
