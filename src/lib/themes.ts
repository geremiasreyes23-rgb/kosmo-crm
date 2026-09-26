import type { ThemeName } from "@prisma/client";

/**
 * Metadatos de los 4 temas visuales del CRM (Avatar → Tema del sistema).
 * Fuente única de verdad compartida entre:
 * - ThemeProvider (aplica el atributo `data-color-theme` al <html>, ver
 *   src/app/globals.css para las variables --brand-* y --theme-* reales de
 *   cada tema).
 * - ThemeModal (dibuja las 4 tarjetas de previsualización).
 * - theme-actions.ts (valida que el valor recibido sea uno de los 4).
 *
 * Los colores de `preview` están duplicados a propósito respecto a
 * globals.css: el modal necesita poder pintar los 4 previews AL MISMO
 * TIEMPO sin importar cuál tema esté activo en ese momento, así que no
 * puede depender de las variables CSS "en vivo" (esas reflejan solo el
 * tema actualmente aplicado al documento).
 */

export const DEFAULT_THEME: ThemeName = "AURORA_VIOLET";

export const THEME_NAMES: ThemeName[] = ["AURORA_VIOLET", "NEBULA_BLUE", "COSMIC_ROSE", "GALAXY_CYAN"];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEME_NAMES as string[]).includes(value);
}

/** `AURORA_VIOLET` -> `"aurora-violet"` — el valor que se escribe en
 * `data-color-theme` y que selecciona el bloque correspondiente en
 * globals.css. */
export function themeAttr(theme: ThemeName): string {
  return theme.toLowerCase().replace(/_/g, "-");
}

export interface ThemeOption {
  value: ThemeName;
  label: string;
  tagline: string;
  /** Color principal — botones, links, foco. */
  primary: string;
  primaryHover: string;
  /** Color secundario — usado en detalles/gradientes del preview. */
  secondary: string;
  /** Degradado del Header/Sidebar (chrome), para el mini-preview. */
  chromeFrom: string;
  chromeTo: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "AURORA_VIOLET",
    label: "Aurora Violet",
    tagline: "Elegante, moderno y espacial — el tema principal de KOSMO.",
    primary: "#8b5cf6",
    primaryHover: "#7c3aed",
    secondary: "#c4b5fd",
    chromeFrom: "#3b2172",
    chromeTo: "#140b34",
  },
  {
    value: "NEBULA_BLUE",
    label: "Nebula Blue",
    tagline: "Tecnológico, frío y profesional.",
    primary: "#2a78d6",
    primaryHover: "#1c5cab",
    secondary: "#8fc1f2",
    chromeFrom: "#142a72",
    chromeTo: "#0a1334",
  },
  {
    value: "COSMIC_ROSE",
    label: "Cosmic Rose",
    tagline: "Moderno, sofisticado y ligeramente cálido.",
    primary: "#c2569f",
    primaryHover: "#a8408a",
    secondary: "#e7b3d8",
    chromeFrom: "#5c2350",
    chromeTo: "#220f34",
  },
  {
    value: "GALAXY_CYAN",
    label: "Galaxy Cyan",
    tagline: "Futurista, limpio y energético.",
    primary: "#06b6d4",
    primaryHover: "#0891b2",
    secondary: "#a5f3fc",
    chromeFrom: "#0b3b45",
    chromeTo: "#071b24",
  },
];
