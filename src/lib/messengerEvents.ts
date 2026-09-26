import "server-only";
import { EventEmitter } from "events";
import type { ChatMessage } from "@/types";

/**
 * Bus de eventos en memoria para el chat en tiempo real — cuando alguien
 * envía un mensaje (server action) se emite acá, y cada pestaña abierta
 * (conectada vía Server-Sent Events, ver app/api/messenger/stream/route.ts)
 * lo recibe al instante sin tener que hacer polling.
 *
 * Funciona porque `next dev`/`next start` corre como UN solo proceso de
 * Node en esta instalación (no serverless/multi-instancia) — si en el
 * futuro la app se despliega en varias instancias detrás de un balanceador,
 * este bus dejaría de alcanzar a los clientes conectados a OTRA instancia y
 * habría que reemplazarlo por algo compartido (Postgres LISTEN/NOTIFY, Redis
 * pub/sub, etc.). Mientras sea una sola instancia, esto es tiempo real de
 * verdad, sin dependencias nuevas ni costo adicional.
 *
 * Patrón singleton en `globalThis` — igual que el PrismaClient de db.ts —
 * para no crear un EventEmitter nuevo (y perder a los suscriptores) en cada
 * hot-reload de `next dev`.
 */
const globalForMessenger = globalThis as unknown as { messengerEvents?: EventEmitter };

export const messengerEvents = globalForMessenger.messengerEvents ?? new EventEmitter();
messengerEvents.setMaxListeners(0); // sin límite — un listener por pestaña conectada

if (process.env.NODE_ENV !== "production") {
  globalForMessenger.messengerEvents = messengerEvents;
}

export interface MessengerMessageEvent {
  type: "message";
  conversationId: string;
  participantIds: [string, string];
  message: ChatMessage;
}

export interface MessengerReadEvent {
  type: "read";
  conversationId: string;
  participantIds: [string, string];
  /** Quién marcó como leído — el otro participante es a quien le interesa
   * este evento, para actualizar sus checkmarks a "leído". */
  readByUserId: string;
  lastReadAt: string;
}

export interface MessengerMessageEditedEvent {
  type: "message-edited";
  conversationId: string;
  participantIds: [string, string];
  messageId: string;
  text: string;
  editedAt: string;
}

export interface MessengerMessageDeletedEvent {
  type: "message-deleted";
  conversationId: string;
  participantIds: [string, string];
  messageId: string;
  deletedAt: string;
}

export interface MessengerMessagePinnedEvent {
  type: "message-pinned";
  conversationId: string;
  participantIds: [string, string];
  messageId: string;
  pinned: boolean;
  pinnedAt: string | null;
}

export type MessengerEvent =
  | MessengerMessageEvent
  | MessengerReadEvent
  | MessengerMessageEditedEvent
  | MessengerMessageDeletedEvent
  | MessengerMessagePinnedEvent;

const CHANNEL = "messenger";

export function publishMessengerEvent(event: MessengerEvent) {
  messengerEvents.emit(CHANNEL, event);
}

export function subscribeMessengerEvents(listener: (event: MessengerEvent) => void): () => void {
  messengerEvents.on(CHANNEL, listener);
  return () => messengerEvents.off(CHANNEL, listener);
}
