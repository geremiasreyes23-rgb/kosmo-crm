// Datos estáticos del chat interno que NO son ficticios — a diferencia de
// los usuarios/conversaciones/mensajes de muestra que vivían acá antes
// (ahora vienen de la base de datos real, ver app/(app)/messages/data.ts),
// el set de stickers es contenido de UI genuino: imágenes ilustradas
// propias (pack del astronauta) que cualquier usuario puede enviar como
// mensaje, mostradas a tamaño grande sin fondo de burbuja.
//
// Cada valor de `stickers` es la ruta pública a un PNG con transparencia
// (servido desde /public/stickers/astronaut/), NO un emoji. Antes de esto
// el set era un puñado de emojis unicode — los mensajes viejos que ya
// quedaron guardados con ese formato siguen mostrándose bien (ver el
// chequeo `startsWith("/")` en MessageBubble/ConversationList/ChatPanel),
// pero el picker ya solo ofrece este pack ilustrado.
export const stickerCategories: { label: string; stickers: string[] }[] = [
  {
    label: "Astronauta",
    stickers: [
      "/stickers/astronaut/01-bandera-planeta.png",
      "/stickers/astronaut/02-pulgar-arriba.png",
      "/stickers/astronaut/03-estrella-corazon.png",
      "/stickers/astronaut/04-saludo.png",
      "/stickers/astronaut/05-volando.png",
      "/stickers/astronaut/06-brazos-cruzados.png",
      "/stickers/astronaut/07-laptop.png",
      "/stickers/astronaut/08-cartel-ok.png",
      "/stickers/astronaut/09-manos-arriba.png",
      "/stickers/astronaut/10-luna.png",
      "/stickers/astronaut/11-telescopio.png",
      "/stickers/astronaut/12-ojos-corazon.png",
      "/stickers/astronaut/13-sentado-planeta.png",
      "/stickers/astronaut/14-cafe.png",
      "/stickers/astronaut/15-dab.png",
    ],
  },
];

/** true si este valor de `sticker` es una imagen (pack actual) en vez de
 * un emoji unicode suelto (formato viejo, todavía puede existir en
 * mensajes ya guardados). */
export function isImageSticker(sticker: string): boolean {
  return sticker.startsWith("/");
}

/** Texto corto para previews (lista de conversaciones, mensaje fijado,
 * notificaciones) donde no tiene sentido mostrar la ruta de archivo de un
 * sticker-imagen tal cual — se usa un glyph genérico en su lugar. Para el
 * formato viejo (emoji suelto) se sigue mostrando el emoji, como antes. */
export function stickerPreviewGlyph(sticker: string): string {
  return isImageSticker(sticker) ? "🧑‍🚀" : sticker;
}
