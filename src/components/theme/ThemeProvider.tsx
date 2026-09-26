"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ThemeName } from "@prisma/client";
import { themeAttr } from "@/lib/themes";
import { setThemePreferenceAction } from "@/app/(app)/profile/theme-actions";

interface ThemeContextValue {
  theme: ThemeName;
  /** Aplica el tema de inmediato (sin recargar) y lo persiste en segundo
   * plano — ver comentario más abajo sobre la actualización optimista. */
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Sistema de temas visuales (Avatar → Tema del sistema).
 *
 * Aplica `data-color-theme` en <html> (document.documentElement), no en
 * algún <div> interno del AppShell: varios modales de la app (AppWindowModal,
 * Drawer) se montan con un portal directo a `document.body`, fuera del árbol
 * de AppShell — si el atributo viviera en un div más adentro, esos modales
 * quedarían siempre con el tema por defecto (Aurora Violet) sin importar lo
 * que el usuario eligió. Puesto en <html>, tanto el árbol normal como
 * cualquier portal a <body> heredan las mismas variables --brand-* y --theme-*.
 *
 * `initialTheme` viene del usuario autenticado (ya resuelto server-side en
 * `(app)/layout.tsx`, sin queries adicionales) — se aplica en un
 * useLayoutEffect (corre antes de que el navegador pinte el commit de
 * React) para minimizar cualquier parpadeo, aunque no lo elimina del todo:
 * la PRIMERA pintada de la página (el HTML que manda el servidor, antes de
 * que cargue el JS) siempre usa el tema por defecto de globals.css. En la
 * práctica esto solo se nota, si acaso, en la carga inicial de una sesión
 * nueva — las navegaciones siguientes dentro de la app no vuelven a
 * desmontar este provider, así que no hay parpadeo alguno después de la
 * primera carga.
 */
export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemeName; children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);
  // Evita persistir en el servidor el valor inicial que ya vino de ahí —
  // solo se guarda cuando el usuario elige un tema distinto.
  const isFirstRun = useRef(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-color-theme", themeAttr(theme));
  }, [theme]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    // Actualización optimista: el color ya cambió en pantalla (efecto de
    // arriba) antes de que esta llamada al servidor siquiera empiece — si
    // falla, se revierte en silencio y se reintenta la próxima vez que el
    // usuario elija un tema. Nunca bloquea ni muestra un loader: es
    // cosmético, no crítico.
    setThemePreferenceAction(theme).catch(() => {
      // No-op — el peor caso es que la preferencia no quede guardada y el
      // usuario tenga que volver a elegirla en su próxima sesión.
    });
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
