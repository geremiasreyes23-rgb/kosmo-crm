"use client";

import { Check, Palette, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME, THEME_OPTIONS, type ThemeOption } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { OVERLAY_MAX_HEIGHT, OVERLAY_TOP_CLASSES, OverlayPortal, useScrollLock } from "@/components/ui/Overlay";

/**
 * Selector de tema visual — Avatar → Tema del sistema (sin paso
 * intermedio, ver el botón en Header.tsx). Mismo lenguaje visual que
 * `Modal.tsx` (cabecera con borde inferior + título, tarjeta blanca
 * redondeada, botón de cierre arriba a la derecha) pero más ancho, porque
 * acá el contenido son 4 tarjetas de previsualización, no un formulario
 * corto.
 *
 * Igual que el resto de ventanas: se monta en <body>, aparece arriba de la
 * pantalla y bloquea el scroll de la página mientras está abierto
 * (ver components/ui/Overlay.tsx).
 */
export function ThemeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  useScrollLock(open);

  if (!open) return null;

  return (
    <OverlayPortal>
    <div
      className={`z-50 bg-black/40 ${OVERLAY_TOP_CLASSES}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-[var(--surface-card)] shadow-xl ${OVERLAY_MAX_HEIGHT}`}>
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Palette className="h-4.5 w-4.5 text-[var(--brand-500)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Tema del sistema</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                Elige la identidad visual del CRM. Solo cambia colores, nada más se mueve.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto overscroll-contain p-5 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => (
            <ThemeCard
              key={option.value}
              option={option}
              selected={theme === option.value}
              onSelect={() => setTheme(option.value)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-hairline)] px-5 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Tu elección se guarda en tu cuenta.</p>
          <button
            type="button"
            onClick={() => setTheme(DEFAULT_THEME)}
            disabled={theme === DEFAULT_THEME}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)] disabled:opacity-40 disabled:pointer-events-none"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar tema predeterminado
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

function ThemeCard({
  option,
  selected,
  onSelect,
}: {
  option: ThemeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all",
        selected
          ? "border-transparent shadow-[0_0_0_2px_var(--card-ring)]"
          : "border-[var(--border-hairline)] hover:border-[var(--card-ring)]"
      )}
      style={{ ["--card-ring" as string]: option.primary }}
    >
      {/* Miniatura: Header + Sidebar + botón, con los colores reales del
          tema — así el usuario ve de verdad "así se vería mi CRM", no solo
          cuatro círculos de color (pedido explícito). */}
      <div
        className="relative flex h-20 w-full"
        style={{
          backgroundImage: `linear-gradient(160deg, ${option.chromeFrom} 0%, ${option.chromeTo} 100%)`,
        }}
      >
        {/* Franja de Sidebar */}
        <div className="flex w-8 flex-col items-center gap-1.5 border-r border-white/10 py-2.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.primary }} />
          <span className="h-1.5 w-4 rounded-full bg-white/25" />
          <span className="h-1.5 w-4 rounded-full bg-white/15" />
          <span className="h-1.5 w-4 rounded-full bg-white/15" />
        </div>
        {/* Header + contenido: una pastilla de "buscador" y un botón
            primario, para mostrar de una el color de acción del tema. */}
        <div className="flex flex-1 flex-col justify-between p-2.5">
          <span className="h-2 w-16 rounded-full bg-white/20" />
          <span
            className="inline-flex h-4 w-14 items-center justify-center rounded-full text-[8px] font-medium text-white"
            style={{ backgroundColor: option.primary }}
          >
            Botón
          </span>
        </div>

        {selected && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--ink-primary)] shadow">
            <Check className="h-3 w-3" style={{ color: option.primary }} />
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 bg-[var(--surface-card)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">{option.label}</p>
          <p className="truncate text-[11px] text-[var(--ink-muted)]">{option.tagline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/10"
            style={{ backgroundColor: option.primary }}
            title="Color principal"
          />
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/10"
            style={{ backgroundColor: option.secondary }}
            title="Color secundario"
          />
        </div>
      </div>

      {selected && (
        <p className="flex items-center gap-1 bg-[var(--surface-hover)] px-3 py-1.5 text-[11px] font-medium text-[var(--ink-primary)]">
          <Check className="h-3 w-3" style={{ color: option.primary }} /> Tema seleccionado
        </p>
      )}
    </button>
  );
}
