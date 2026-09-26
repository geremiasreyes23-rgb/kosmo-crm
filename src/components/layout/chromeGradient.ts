import type { CSSProperties } from "react";

/**
 * Degradado morado → negro compartido por el Sidebar y el Header — antes
 * eran dos fondos independientes (el sidebar tenía su propio degradado +
 * estrellas animadas, el header era una barra blanca lisa), así que se
 * veían como dos piezas separadas en vez de un solo panel.
 *
 * La clave para que combinen sin costura visible en la esquina donde se
 * tocan es `backgroundAttachment: "fixed"`: con eso el degradado se pinta
 * en coordenadas del VIEWPORT, no de la caja de cada elemento — así que
 * aunque Sidebar y Header sean elementos DOM distintos, el color en el
 * punto exacto donde se tocan es idéntico en ambos, como si fuera un único
 * fondo continuo detrás de los dos.
 *
 * Sistema de temas (Avatar → Tema del sistema): el degradado y el color de
 * fondo YA NO son un string fijo — leen `--theme-chrome-gradient` y
 * `--theme-chrome-bg`, definidas por tema en globals.css (4 variantes:
 * Aurora Violet/Nebula Blue/Cosmic Rose/Galaxy Cyan). `var(--x)` funciona
 * igual dentro de un string de `style` en línea que en una hoja de estilos
 * — el navegador lo resuelve contra la cascada real en cada pintada, así
 * que al cambiar `data-color-theme` en <html> (ver ThemeProvider.tsx) este
 * degradado cambia de tono sin que este archivo ni sus consumidores
 * (Sidebar, Header, AppShell) sepan nada del tema activo.
 *
 * `transition` va acá puntualmente (y no como regla CSS global) porque
 * `background-image` no siempre interpola entre degradados — declarar la
 * transición junto al propio valor es lo mínimo necesario para que el
 * cambio de tema se sienta suave donde el navegador lo soporte, sin tocar
 * ningún otro elemento de la interfaz.
 */
export const CHROME_GRADIENT_STYLE: CSSProperties = {
  backgroundImage: "var(--theme-chrome-gradient)",
  backgroundAttachment: "fixed",
  backgroundColor: "var(--theme-chrome-bg)",
  transition: "background-color 220ms ease",
};
