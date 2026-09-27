import { getSessionUser } from "@/lib/auth";
import { messengerEvents } from "@/lib/messengerEvents";

// Ruta de diagnóstico TEMPORAL — para confirmar si el problema de "los
// mensajes no llegan en vivo" es que Railway está corriendo más de una
// instancia del server (en cuyo caso el bus de eventos en memoria de
// messengerEvents.ts, que asume un solo proceso, no alcanza a todas las
// pestañas conectadas). Se borra en cuanto se confirme o descarte esto.
export const dynamic = "force-dynamic";

const BOOT_ID = crypto.randomUUID();

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const lines = [
    `PID del proceso: ${process.pid}`,
    `ID de arranque: ${BOOT_ID}`,
    `Suscriptores de mensajería conectados ahora mismo: ${messengerEvents.listenerCount("messenger")}`,
    `Hora del servidor: ${new Date().toISOString()}`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
