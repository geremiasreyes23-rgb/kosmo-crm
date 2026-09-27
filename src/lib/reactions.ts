import "server-only";
import type { MessageReactionGroup } from "@/types";

/**
 * Agrupa filas sueltas de MessageReaction (una fila por persona que
 * reaccionó) en la forma que consume el cliente: un grupo por emoji con la
 * lista de quienes reaccionaron con ese emoji. Se usa tanto al armar la
 * carga inicial de Mensajería (messages/data.ts) como al responder cada
 * toggleReactionAction — un solo lugar para no repetir esta lógica en los
 * dos.
 */
export function groupReactions(rows: { emoji: string; userId: string }[]): MessageReactionGroup[] {
  const order: string[] = [];
  const byEmoji = new Map<string, string[]>();
  for (const r of rows) {
    const list = byEmoji.get(r.emoji);
    if (list) {
      list.push(r.userId);
    } else {
      byEmoji.set(r.emoji, [r.userId]);
      order.push(r.emoji);
    }
  }
  return order.map((emoji) => ({ emoji, userIds: byEmoji.get(emoji)! }));
}
