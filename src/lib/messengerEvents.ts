import "server-only";
import { EventEmitter } from "events";
import type { ChatMessage } from "@/types";

/**
 * Bus de eventos en memoria para el chat en tiempo real — cuando alguien
 * envía un mensaje (server action) se emite acá, y cada pestaña abierta
 * (conectada vía Server-Sent Events, ver app/api/messenger/stream/route.ts)
 * lo recibe al instante sin tener que hacer polling.
 *
 * Funciona mientras la app corra como UN solo proceso de Node (no
 * serverless/multi-instancia) — si en el futuro se despliega en varias
 * instancias detrás de un balanceador, este bus dejaría de alcanzar a los
 * clientes conectados a OTRA instancia y habría que reemplazarlo por algo
 * compartido (Postgres LISTEN/NOTIFY, Redis pub/sub, etc.).
 *
 * Patrón singleton en `globalThis` — igual que el PrismaClient de db.ts —
 * y SIEMPRE, en todo entorno, no solo en desarrollo. Next.js compila las
 * Server Actions y los Route Handlers en bundles de servidor separados, y
 * cada uno evalúa su propia copia de este módulo — sin persistir en
 * `globalThis` en TODOS los entornos, la Server Action que publica un
 * mensaje y el Route Handler SSE que lo debería reenviar terminan con dos
 * EventEmitter distintos aunque compartan el mismo proceso de Node, y el
 * evento se publica sin que nadie esté escuchando (bug real encontrado y
 * confirmado en producción el 2026-09-27 vía logs de diagnóstico: todo
 * publish mostraba "listeners=0"). `globalThis` sí es compartido de verdad
 * entre esos bundles dentro de un mismo proceso — por eso el fix es
 * dejar de saltear esta línea en producción.
 */
const globalForMessenger = globalThis as unknown as { messengerEvents?: EventEmitter };

export const messengerEvents = globalForMessenger.messengerEvents ?? new EventEmitter();
messengerEvents.setMaxListeners(0); // sin límite — un listener por pestaña conectada
globalForMessenger.messengerEvents = messengerEvents;

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

/** A diferencia de los demás eventos (que solo le interesan a los dos
 * participantes de una conversación puntual, ver participantIds), la
 * presencia le interesa a CUALQUIERA que tenga a esa persona en su lista de
 * conversaciones — como acá "todos con todos" pueden chatear, se difunde a
 * todas las pestañas conectadas sin filtrar por participantIds (ver
 * PresenceEvent, sin ese campo a propósito). */
export interface PresenceEvent {
  type: "presence";
  userId: string;
  online: boolean;
}

export type MessengerEvent =
  | MessengerMessageEvent
  | MessengerReadEvent
  | MessengerMessageEditedEvent
  | MessengerMessageDeletedEvent
  | MessengerMessagePinnedEvent;

const CHANNEL = "messenger";
const PRESENCE_CHANNEL = "messenger-presence";

export function publishMessengerEvent(event: MessengerEvent) {
  messengerEvents.emit(CHANNEL, event);
}

export function subscribeMessengerEvents(listener: (event: MessengerEvent) => void): () => void {
  messengerEvents.on(CHANNEL, listener);
  return () => messengerEvents.off(CHANNEL, listener);
}

export function publishPresenceEvent(event: PresenceEvent) {
  messengerEvents.emit(PRESENCE_CHANNEL, event);
}

export function subscribePresenceEvents(listener: (event: PresenceEvent) => void): () => void {
  messengerEvents.on(PRESENCE_CHANNEL, listener);
  return () => messengerEvents.off(PRESENCE_CHANNEL, listener);
}
