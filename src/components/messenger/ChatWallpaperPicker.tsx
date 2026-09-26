"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, RotateCcw } from "lucide-react";

/**
 * Selector de fondo del chat — igual que WhatsApp permite elegir un color
 * sólido para el fondo de la conversación. Es puramente presentacional: no
 * guarda nada por su cuenta, solo avisa al padre (`onChange`) que es quien
 * decide dónde persistir la elección (ver ChatPanel.tsx, que la guarda en
 * localStorage para que se recuerde entre sesiones en este navegador).
 */
const PRESET_COLORS = [
  "#EFEAE2", // beige clásico (el "wallpaper" original de WhatsApp)
  "#E3E8FB", // lavanda suave
  "#DCF0EA", // menta suave
  "#FDECE3", // durazno suave
  "#E8F3FF", // celeste suave
  "#EEF7E0", // verde suave
  "#F3E8FF", // lila suave
  "#FDE8EF", // rosa suave
  "#2A2A38", // gris carbón
  "#0B141A", // oscuro (estilo modo oscuro de WhatsApp)
  "#1C1030", // morado oscuro KOSMO
  "#FFFFFF", // blanco puro
];

function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function ChatWallpaperPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Fondo del chat"
        aria-label="Fondo del chat"
        className="rounded-md p-2 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
      >
        <Palette className="h-4 w-4" />
      </button>

      {open && (
        <div className="animate-kosmo-fade-in-scale absolute right-0 top-full z-30 mt-2 w-60 origin-top-right rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold text-[var(--ink-primary)]">Fondo del chat</p>

          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                title={color}
                aria-label={`Fondo ${color}`}
                className="relative h-7 w-7 rounded-full border border-[var(--border-hairline)] transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
              >
                {value?.toLowerCase() === color.toLowerCase() && (
                  <Check
                    className="absolute inset-0 m-auto h-3.5 w-3.5"
                    style={{ color: isLightColor(color) ? "#0a0a1f" : "#fff" }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
            <label className="flex flex-1 items-center gap-2 text-xs text-[var(--ink-secondary)]">
              <input
                type="color"
                value={value ?? "#efeae2"}
                onChange={(e) => onChange(e.target.value)}
                className="h-6 w-8 shrink-0 cursor-pointer rounded border border-[var(--border-hairline)] bg-transparent p-0"
              />
              Personalizado
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                title="Quitar fondo"
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
