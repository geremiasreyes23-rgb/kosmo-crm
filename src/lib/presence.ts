import "server-only";
import { publishPresenceEvent } from "./messengerEvents";

/**
 * Presencia en línea REAL — antes, "En línea" en Mensajería salía de
 * `prisma.session` (¿tiene una sesión sin vencer?), y una sesión dura 14
 * días (ver SESSION_TTL_DAYS en auth.ts): cualquiera que se hubiera
 * logueado en las últimas dos semanas aparecía "en línea" para siempre,
 * aunque hubiera cerrado la pestaña hace días. Eso es "¿tiene una sesión
 * válida?", no "¿está conectado ahora mismo?".
 *
 * Esto en cambio cuenta conexiones SSE realmente abiertas ahora mismo (ver
 * app/api/messenger/stream/route.ts) — mientras Mensajería está montada en
 * el layout de toda la app (MessengerProvider envuelve AppShell), esa
 * conexión se mantiene abierta todo el tiempo que el usuario tenga una
 * pestaña abierta, y se cierra sola cuando cierra la pestaña/navegador o se
 * corta la red. Eso sí es presencia real.
 *
 * Un usuario puede tener varias pestañas abiertas — se cuenta cuántas
 * conexiones tiene cada uno (no un booleano), y solo se considera "offline"
 * cuando la cuenta llega a 0. Al llegar a 0 se espera un pequeño margen
 * (OFFLINE_GRACE_MS) antes de avisar que se desconectó — el navegador
 * reconecta un EventSource solo ante un corte breve de red, y sin este
 * margen esa reconexión se vería como un parpadeo en línea/desconectado.
 *
 * Mismo supuesto de instancia única que messengerEvents.ts/
 * notificationScheduler.ts — un solo proceso de Node. En varias instancias
 * detrás de un balanceador, cada una vería solo sus propias conexiones;
 * habría que centralizar esto (Redis, Postgres) para que la presencia sea
 * correcta entre instancias.
 */
const OFFLINE_GRACE_MS = 15_000;

interface PresenceState {
  connections: Map<string, number>;
  pendingOffline: Map<string, ReturnType<typeof setTimeout>>;
}

const globalForPresence = globalThis as unknown as { messengerPresence?: PresenceState };

const state: PresenceState = globalForPresence.messengerPresence ?? {
  connections: new Map(),
  pendingOffline: new Map(),
};
globalForPresence.messengerPresence = state;

function notify(userId: string, online: boolean) {
  publishPresenceEvent({ type: "presence", userId, online });
}

/** Nueva conexión SSE abierta para este usuario — llamar al iniciar el stream. */
export function markUserOnline(userId: string): void {
  const pending = state.pendingOffline.get(userId);
  if (pending) {
    clearTimeout(pending);
    state.pendingOffline.delete(userId);
  }

  const count = state.connections.get(userId) ?? 0;
  state.connections.set(userId, count + 1);
  if (count === 0) notify(userId, true);
}

/** Una conexión SSE de este usuario se cerró — llamar al cancelarse el stream. */
export function markUserOffline(userId: string): void {
  const count = state.connections.get(userId) ?? 0;
  if (count <= 1) {
    state.connections.delete(userId);
    const timeout = setTimeout(() => {
      state.pendingOffline.delete(userId);
      if (!state.connections.has(userId)) notify(userId, false);
    }, OFFLINE_GRACE_MS);
    state.pendingOffline.set(userId, timeout);
  } else {
    state.connections.set(userId, count - 1);
  }
}

export function isUserOnline(userId: string): boolean {
  return state.connections.has(userId);
}

export function getOnlineUserIds(): Set<string> {
  return new Set(state.connections.keys());
}
