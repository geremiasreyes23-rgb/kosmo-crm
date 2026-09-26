// Datos estáticos del chat interno que NO son ficticios — a diferencia de
// los usuarios/conversaciones/mensajes de muestra que vivían acá antes
// (ahora vienen de la base de datos real, ver app/(app)/messages/data.ts),
// el set de stickers es contenido de UI genuino: emojis grandes que
// cualquier usuario puede enviar, sin necesidad de arte propio.

/** Set de "stickers" — emojis grandes, organizados por categoría, se
 * envían y se muestran a tamaño grande sin fondo de burbuja. */
export const stickerCategories: { label: string; stickers: string[] }[] = [
  { label: "Reacciones", stickers: ["👍", "🙌", "👏", "🙏", "😂", "😮", "😢", "❤️"] },
  { label: "Trabajo", stickers: ["✅", "📌", "📎", "📷", "🗓️", "⏰", "💼", "📝"] },
  { label: "Celebración", stickers: ["🎉", "🥳", "🏆", "💪", "🔥", "⭐", "💯", "🚀"] },
];
