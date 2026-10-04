"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Velocidad del desplazamiento continuo al posar el mouse (px por frame). */
const HOVER_SPEED = 9;

/**
 * Contenedor con desplazamiento horizontal SIN barra visible. En su lugar,
 * al pasar el mouse por el contenedor aparecen deslizadores a la izquierda
 * y a la derecha (solo hacia donde hay más contenido):
 *  - posar el mouse sobre un deslizador desplaza de forma continua,
 *  - hacer clic salta casi una pantalla completa,
 *  - también funciona mientras se arrastra una tarjeta (Kanban).
 * En pantallas táctiles se sigue pudiendo deslizar con el dedo.
 */
export function HScroll({
  children,
  className,
  innerClassName,
  size = "md",
  stickyArrows = false,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** "sm" para barras finas (pestañas); "md" para tableros y tablas. */
  size?: "sm" | "md";
  /** Contenido alto (Kanban): el botón acompaña el scroll vertical de la
   * página para seguir a la vista. */
  stickyArrows?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update]);

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const start = useCallback(
    (dir: -1 | 1) => {
      stop();
      const tick = () => {
        const el = ref.current;
        if (!el) return;
        el.scrollLeft += dir * HOVER_SPEED;
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [stop]
  );

  useEffect(() => {
    // Si se suelta una tarjeta en cualquier parte, deja de desplazar.
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
      stop();
    };
  }, [stop]);
  // Al llegar al borde, el deslizador desaparece: detener la animación.
  useEffect(() => {
    if (!canLeft && !canRight) stop();
  }, [canLeft, canRight, stop]);

  function jump(dir: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const slider = (dir: -1 | 1) => {
    const visible = dir === -1 ? canLeft : canRight;
    if (!visible) return null;
    const Icon = dir === -1 ? ChevronLeft : ChevronRight;
    return (
      <div
        className={cn(
          "absolute inset-y-0 z-10 flex flex-col opacity-0 transition-opacity duration-150 group-hover/hscroll:opacity-100",
          dir === -1 ? "left-0" : "right-0",
          size === "sm" ? "w-8" : "w-14"
        )}
        onMouseEnter={() => start(dir)}
        onMouseLeave={stop}
        onDragEnter={() => start(dir)}
        onDragLeave={stop}
      >
        <button
          type="button"
          aria-label={dir === -1 ? "Desplazar a la izquierda" : "Desplazar a la derecha"}
          onClick={() => jump(dir)}
          className={cn(
            "flex items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-secondary)] shadow-md transition-transform hover:scale-110 hover:text-[var(--brand-500)]",
            size === "sm" ? "my-auto h-6 w-6" : "my-auto h-9 w-9",
            stickyArrows && "sticky top-[45vh]",
            dir === -1 ? "ml-1" : "ml-auto mr-1"
          )}
        >
          <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
        </button>
      </div>
    );
  };

  return (
    <div className={cn("group/hscroll relative", className)}>
      {slider(-1)}
      <div ref={ref} className={cn("kosmo-no-scrollbar overflow-x-auto", innerClassName)}>
        {children}
      </div>
      {slider(1)}
    </div>
  );
}
