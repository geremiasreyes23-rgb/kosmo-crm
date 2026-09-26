import { getSessionUser } from "@/lib/auth";
import { subscribeNotificationEvents } from "@/lib/notificationEvents";

// Nunca cachear/optimizar esta ruta estáticamente — es un stream que se
// mantiene abierto mientras dure la pestaña (mismo patrón que
// app/api/messenger/stream/route.ts).
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events de la campanita de notificaciones — cada pestaña
 * abierta mantiene una conexión GET acá. Cuando se crea una notificación
 * (correo interno, mensaje de chat, o el scheduler de tareas/citas/Turning
 * 65) se publica en notificationEvents.ts y esta ruta la reenvía de
 * inmediato, sin polling.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // El controller ya se cerró (cliente desconectado) — se limpia en cancel().
        }
      }

      unsubscribe = subscribeNotificationEvents((event) => {
        if (event.userId === user.id) {
          send(event);
        }
      });

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
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
