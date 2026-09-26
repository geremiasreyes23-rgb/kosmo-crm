// Arranca una sola vez cuando el server de Next.js levanta (dev o prod) —
// ver node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md.
// Lo único que hace hoy es poner en marcha el scheduler de notificaciones
// automáticas (tareas vencidas/por vencer, citas próximas, Turning 65) —
// ver src/lib/notificationScheduler.ts.
export async function register() {
  // Guardia de runtime — este archivo se evalúa también en el runtime Edge
  // en algunos escenarios, y Prisma/EventEmitter en Node solo tienen
  // sentido en el runtime de Node.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNotificationScheduler } = await import("./lib/notificationScheduler");
    startNotificationScheduler();
  }
}
