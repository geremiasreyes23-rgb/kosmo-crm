import { getSessionUser } from "@/lib/auth";
import { subscribeMessengerEvents, subscribePresenceEvents } from "@/lib/messengerEvents";
import { markUserOnline, markUserOffline } from "@/lib/presence";

// Nunca cachear/optimizar esta ruta estáticamente — es un stream que se
// mantiene abierto mientras dure la pestaña.
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events del chat interno — cada pestaña abierta mantiene una
 * conexión GET abierta acá. Cuando alguien envía un mensaje (o marca una
 * conversación como leída), el server action correspondiente publica el
 * evento en messengerEvents.ts y esta ruta lo reenvía de inmediato a los dos
 * participantes conectados — mensajería en tiempo real sin agregar
 * WebSockets, servicios externos ni dependencias nuevas.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }
  const userId = user.id;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let unsubscribePresence: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          // LOG TEMPORAL DE DIAGNÓSTICO — se borra en cuanto se resuelva el
          // bug de mensajes que no llegan en tiempo real.
          console.log(
            `[DIAG messenger/stream] enqueue OK para user=${userId} data=${JSON.stringify(data).slice(0, 120)}`
          );
        } catch (err) {
          console.log(`[DIAG messenger/stream] enqueue FALLÓ para user=${userId}: ${String(err)}`);
          // El controller ya se cerró (cliente desconectado) — se limpia en cancel().
        }
      }

      unsubscribe = subscribeMessengerEvents((event) => {
        const matches = event.participantIds.includes(userId);
        console.log(
          `[DIAG messenger/stream] evento recibido type=${event.type} conv=${event.conversationId} participantIds=${JSON.stringify(event.participantIds)} yo=${userId} coincide=${matches}`
        );
        if (matches) {
          send(event);
        }
      });

      // Presencia — a diferencia de arriba, se reenvía a TODOS los
      // conectados (nadie queda afuera del filtro de participantIds, ver
      // messengerEvents.ts) para que el punto verde de cualquier persona se
      // actualice en cualquier pestaña que la tenga en su lista.
      unsubscribePresence = subscribePresenceEvents((event) => {
        send(event);
      });

      // Esta pestaña cuenta como una conexión real de `user` — presencia
      // de verdad, no "¿tiene una sesión sin vencer?" (ver src/lib/presence.ts).
      markUserOnline(userId);

      // Mantiene viva la conexión a través de proxies/balanceadores que
      // cortan conexiones inactivas (comentario SSE — el cliente lo ignora).
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ver arriba
        }
      }, 25000);

      send({ type: "connected" });
    },
    cancel() {
      unsubscribe?.();
      unsubscribePresence?.();
      if (heartbeat) clearInterval(heartbeat);
      markUserOffline(userId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Railway (y otros hosts detrás de un proxy tipo nginx) por defecto
      // bufferean la respuesta HTTP hasta que se llena el buffer o se
      // cierra la conexión — en un stream SSE eso significa que los
      // eventos NO llegan al instante, quedan atascados hasta que algo
      // fuerza el flush (ej. recargar la página, que abre una conexión
      // nueva y trae todo fresco desde la base de datos). Este header le
      // dice explícitamente al proxy que no bufferee esta respuesta.
      "X-Accel-Buffering": "no",
    },
  });
}
