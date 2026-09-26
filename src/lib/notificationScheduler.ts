import "server-only";
import { prisma } from "./db";
import { publishNotificationEvent } from "./notificationEvents";
import type { NotificationVM } from "@/types";

/**
 * Generador de notificaciones automáticas — corre dentro del mismo proceso
 * de Node de `next dev`/`next start` (ver instrumentation.ts, que lo
 * arranca una sola vez cuando el server levanta) y cada cierto tiempo
 * revisa la base buscando cosas que deberían avisarle a alguien: tareas
 * vencidas o por vencer, citas próximas, clientes por cumplir 65 años.
 *
 * Mismo supuesto de instancia única que messengerEvents.ts/notificationEvents.ts
 * — si el día de mañana esto corre en varias instancias detrás de un
 * balanceador, cada una dispararía su propio scan. No es grave (la
 * deduplicación por (userId,type,relatedEntityType,relatedEntityId) evita
 * notificaciones repetidas) pero sí redundante; ese día conviene mover el
 * scan a un cron real fuera de la app.
 *
 * El correo interno y los mensajes de Mensajería NO pasan por acá — esos ya
 * generan su Notification directo en el momento (mail/actions.ts y
 * messages/actions.ts), porque son eventos puntuales, no algo que haya que
 * "descubrir" revisando la base.
 */

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos
const FIRST_SCAN_DELAY_MS = 10 * 1000; // el primer scan no espera el intervalo completo
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000; // "por vencer" / "próxima" = dentro de 24hs
const TURNING_65_WINDOW_DAYS = 30;

function toVM(row: {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: Date;
}): NotificationVM {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.relatedEntityType ?? undefined,
    relatedEntityId: row.relatedEntityId ?? undefined,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Crea la notificación solo si no existe ya una igual (mismo usuario, tipo
 * y entidad relacionada) — así el scan puede correr cada 5 minutos sin
 * duplicar avisos cada vez que vuelve a encontrar la misma tarea vencida. */
async function createIfMissing(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
    select: { id: true },
  });
  if (existing) return;

  const row = await prisma.notification.create({ data: params });
  publishNotificationEvent({ type: "notification", userId: params.userId, notification: toVM(row) });
}

async function scanTasks(now: Date) {
  const soon = new Date(now.getTime() + UPCOMING_WINDOW_MS);

  const overdue = await prisma.task.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: now } },
    select: { id: true, title: true, assignedToId: true },
  });
  for (const t of overdue) {
    await createIfMissing({
      userId: t.assignedToId,
      type: "task_overdue",
      title: "Tarea vencida",
      message: t.title,
      relatedEntityType: "Task",
      relatedEntityId: t.id,
    });
  }

  const upcoming = await prisma.task.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { gte: now, lte: soon } },
    select: { id: true, title: true, assignedToId: true },
  });
  for (const t of upcoming) {
    await createIfMissing({
      userId: t.assignedToId,
      type: "task_upcoming",
      title: "Tarea por vencer",
      message: t.title,
      relatedEntityType: "Task",
      relatedEntityId: t.id,
    });
  }
}

async function scanAppointments(now: Date) {
  const soon = new Date(now.getTime() + UPCOMING_WINDOW_MS);
  const upcoming = await prisma.appointment.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
      startsAt: { gte: now, lte: soon },
    },
    select: { id: true, title: true, userId: true },
  });
  for (const a of upcoming) {
    await createIfMissing({
      userId: a.userId,
      type: "upcoming_appointment",
      title: "Cita próxima",
      message: a.title,
      relatedEntityType: "Appointment",
      relatedEntityId: a.id,
    });
  }
}

async function scanTurning65(now: Date) {
  const clients = await prisma.client.findMany({
    where: { dob: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      agent: { select: { user: { select: { id: true } } } },
    },
  });

  for (const c of clients) {
    if (!c.dob || !c.agent?.user) continue; // sin agente vinculado a un User, no hay a quién avisarle
    const turns65 = new Date(c.dob);
    turns65.setFullYear(turns65.getFullYear() + 65);
    const daysUntil = (turns65.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    if (daysUntil < 0 || daysUntil > TURNING_65_WINDOW_DAYS) continue;

    await createIfMissing({
      userId: c.agent.user.id,
      type: "turning_65",
      title: "Cliente cumple 65 años",
      message: `${c.firstName} ${c.lastName} cumple 65 el ${turns65.toLocaleDateString("es-ES")}`,
      relatedEntityType: "Client",
      relatedEntityId: c.id,
    });
  }
}

export async function scanAndGenerateNotifications() {
  const now = new Date();
  try {
    await scanTasks(now);
    await scanAppointments(now);
    await scanTurning65(now);
  } catch (err) {
    // El scheduler nunca debe tirar abajo el server por un error de un
    // scan puntual — se loguea y se reintenta en el próximo ciclo.
    console.error("[notificationScheduler] error durante el scan:", err);
  }
}

const globalForScheduler = globalThis as unknown as { notificationSchedulerStarted?: boolean };

/** Arranca el scheduler — llamado una sola vez desde instrumentation.ts
 * cuando el server de Next levanta. Guardado en `globalThis` para que un
 * hot-reload de `next dev` no lo duplique. */
export function startNotificationScheduler() {
  if (globalForScheduler.notificationSchedulerStarted) return;
  globalForScheduler.notificationSchedulerStarted = true;

  setTimeout(() => {
    void scanAndGenerateNotifications();
    setInterval(() => {
      void scanAndGenerateNotifications();
    }, SCAN_INTERVAL_MS);
  }, FIRST_SCAN_DELAY_MS);
}
