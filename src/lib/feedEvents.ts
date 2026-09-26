import "server-only";
import { EventEmitter } from "events";

/**
 * Bus de eventos en memoria del Feed — mismo patrón que
 * src/lib/messengerEvents.ts / notificationEvents.ts (ver los comentarios
 * ahí para el porqué del singleton en `globalThis` y la limitación de una
 * sola instancia de Node), pero deliberadamente en SU PROPIO EventEmitter y
 * su propia ruta (app/api/feed/stream/route.ts) — el módulo del Feed no
 * modifica messengerEvents.ts ni la conexión SSE de Mensajería para nada de
 * esto, queda 100% aislado.
 *
 * El Feed no necesita filtrar por participantes (a diferencia de un chat
 * 1:1): cualquier cambio (post nuevo, comentario, reacción, fijado) se
 * transmite a todas las pestañas conectadas a /feed, que simplemente vuelven
 * a pedir sus datos al server (router.refresh()) — no se intenta fusionar
 * el estado en el cliente, así cada quien ve el Feed con SUS propios
 * permisos (fijar, editar, eliminar) recalculados correctamente en el
 * servidor en cada refresh, en vez de confiar en un payload genérico.
 */
const globalForFeed = globalThis as unknown as { feedEvents?: EventEmitter };

export const feedEvents = globalForFeed.feedEvents ?? new EventEmitter();
feedEvents.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForFeed.feedEvents = feedEvents;
}

export interface FeedChangedEvent {
  type: "feed-changed";
  reason: "post-created" | "post-updated" | "post-deleted" | "post-pinned" | "comment-created" | "reaction-changed";
}

const CHANNEL = "feed";

export function publishFeedEvent(event: FeedChangedEvent) {
  feedEvents.emit(CHANNEL, event);
}

export function subscribeFeedEvents(listener: (event: FeedChangedEvent) => void): () => void {
  feedEvents.on(CHANNEL, listener);
  return () => feedEvents.off(CHANNEL, listener);
}
