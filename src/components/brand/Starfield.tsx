"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo animado tipo "espacio profundo" para pantallas de marca (login).
 * Canvas 2D con capas de estrellas a distinta profundidad (parche sutil
 * de parallax + centelleo) sobre un degradado nocturno con un par de
 * halos de color tipo nebulosa. Se redimensiona con la ventana y respeta
 * prefers-reduced-motion deteniendo el centelleo/drift.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  layer: number; // 0 = far/slow, 1 = mid, 2 = near/fast
}

export function Starfield({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    let rafId = 0;

    function buildStars() {
      const density = (width * height) / 9000; // ~ estrellas por área
      const count = Math.max(90, Math.min(320, Math.round(density)));
      stars = Array.from({ length: count }, () => {
        const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.85 ? 1 : 2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: layer === 0 ? Math.random() * 0.7 + 0.3 : layer === 1 ? Math.random() * 1 + 0.6 : Math.random() * 1.4 + 1,
          baseAlpha: Math.random() * 0.5 + 0.35,
          twinkleSpeed: Math.random() * 0.015 + 0.004,
          twinklePhase: Math.random() * Math.PI * 2,
          layer,
        };
      });
    }

    function resize() {
      const parent = canvas!.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    resize();
    window.addEventListener("resize", resize);

    // Además de la ventana, observamos el propio contenedor: se usa dentro
    // de paneles que cambian de ancho por CSS (p. ej. el sidebar al
    // recogerse/expandirse), lo cual no dispara un "resize" de window.
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas.parentElement);
    }

    let t = 0;
    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (const s of stars) {
        const twinkle = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha + Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.3;
        const alpha = Math.max(0, Math.min(1, twinkle));
        const drift = reduceMotion ? 0 : (t * (0.006 + s.layer * 0.01)) % (width + 20);
        const x = ((s.x + drift + width) % width + width) % width;

        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx!.arc(x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();

        if (s.layer === 2 && alpha > 0.75) {
          ctx!.beginPath();
          ctx!.fillStyle = `rgba(150,180,255,${alpha * 0.25})`;
          ctx!.arc(x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      t += 1;
      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
