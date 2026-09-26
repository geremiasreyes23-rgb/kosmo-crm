import type { FeedReactionType } from "@/types";

/** Catálogo de reacciones — mismo patrón que recognitionTypes.ts (Perfil de
 * usuario): agregar una reacción nueva es un valor de enum + una entrada
 * acá, sin tocar los componentes que las renderizan. */
export const REACTION_ORDER: FeedReactionType[] = ["LIKE", "LOVE", "CELEBRATE", "CLAP"];

export const REACTION_META: Record<FeedReactionType, { emoji: string; label: string }> = {
  LIKE: { emoji: "👍", label: "Me gusta" },
  LOVE: { emoji: "❤️", label: "Me encanta" },
  CELEBRATE: { emoji: "🎉", label: "Celebrar" },
  CLAP: { emoji: "👏", label: "Aplausos" },
};
