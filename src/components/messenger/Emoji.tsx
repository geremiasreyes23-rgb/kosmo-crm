"use client";

import sheetData from "@/data/appleEmojiSheet.json";

// Hoja de sprites de Apple auto-alojada en /public/emoji (NUNCA se pide a
// un CDN externo en tiempo real — ver comentario largo más abajo). Las
// coordenadas x/y de cada emoji dentro de la hoja, y el tamaño de la
// grilla (cols/rows), salen del dataset oficial de emoji-mart
// (@emoji-mart/data, set "apple", versión 15) ya procesado en
// src/data/appleEmojiSheet.json — ver ese archivo o EmojiPicker.tsx para
// cómo se generó.
const SHEET_URL = "/emoji/apple-sheet-64.png";
const { cols, rows, positions } = sheetData as unknown as {
  cols: number;
  rows: number;
  positions: Record<string, [number, number]>;
};

/**
 * Un único emoji renderizado con el set de imágenes estilo Apple/iOS —
 * nunca con la fuente de emoji nativa del sistema operativo (que en
 * Windows es Segoe UI Emoji, con otro diseño). Se usa en todo
 * Mensajería: burbujas de mensaje, stickers y el propio selector, para
 * que el emoji se vea idéntico sin importar el dispositivo de quien lo
 * mira.
 *
 * Importante: la imagen sale de /public/emoji/apple-sheet-64.png, servida
 * por este mismo servidor — a propósito NO se usa un CDN externo (como
 * hace la librería emoji-mart por defecto) porque esa dependencia
 * resultó nada confiable: se cayó silenciosamente en las pruebas
 * (bloqueada por red/firewall) y dejaba placeholders genéricos en vez de
 * emojis. Auto-alojarla la hace tan confiable como cualquier otra imagen
 * del CRM.
 */
export function Emoji({ native, size = 20 }: { native: string; size?: number | string }) {
  const px = typeof size === "number" ? `${size}px` : size;
  const pos = positions[native];

  if (!pos) {
    // Emoji fuera del catálogo (rarísimo — variante nueva que el dataset
    // todavía no cubre). Se muestra igual con la fuente nativa del
    // sistema en vez de quedar en blanco.
    return (
      <span role="img" aria-label={native} style={{ fontSize: px, lineHeight: 1 }}>
        {native}
      </span>
    );
  }

  const [x, y] = pos;
  return (
    <span
      role="img"
      aria-label={native}
      style={{
        display: "inline-block",
        verticalAlign: "-0.2em",
        width: px,
        height: px,
        backgroundImage: `url(${SHEET_URL})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${(100 / (cols - 1)) * x}% ${(100 / (rows - 1)) * y}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
