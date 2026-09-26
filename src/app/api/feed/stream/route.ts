import { getSessionUser } from "@/lib/auth";
import { subscribeFeedEvents } from "@/lib/feedEvents";

// Nunca cachear/optimizar esta ruta estáticamente — es un stream que se
// mantiene abierto mientras la pestaña tenga /feed abierto (a diferencia de
// Mensajería, esta conexión solo vive mientras se está en esa página, ver
// FeedProvider.tsx).
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events del Feed — ruta aislada, no comparte conexión ni bus
 * con Mensajería (ver src/lib/feedEvents.ts). Cada pestaña con /feed abierto
 * mantiene una conexión GET acá; cuando algo cambia (post, comentario,
 * reacción, fijado) esta ruta le avisa y el cliente vuelve a pedir sus
 * datos al servidor.
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

      unsubscribe = subscribeFeedEvents((event) => send(event));

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
