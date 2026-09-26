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
const DOC_PENDING_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 días parado en "Documentación pendiente"
const DOC_PENDING_STAGE_NAME = "Documentación pendiente";

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

interface PendingNotification {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}

function notificationKey(n: Pick<PendingNotification, "userId" | "type" | "relatedEntityType" | "relatedEntityId">) {
  return `${n.userId}|${n.type}|${n.relatedEntityType}|${n.relatedEntityId}`;
}

/** Fase 15 (auditoría de rendimiento) — versión en lote de lo que antes era
 * createIfMissing() llamado una vez por fila dentro de un for. Con cientos
 * de tareas vencidas/leads parados, eso era un SELECT (y a veces INSERT)
 * secuencial POR FILA, cada 5 minutos, para siempre — la enorme mayoría ya
 * notificadas en un scan anterior. Acá se resuelve "¿cuáles de estos N ya
 * existen?" con un único SELECT (un OR de tuplas), y solo se hace un INSERT
 * por cada una que de verdad sea nueva (típicamente ninguna, en estado
 * estable).
 */
async function createMissingNotifications(items: PendingNotification[]) {
  if (items.length === 0) return;

  const existing = await prisma.notification.findMany({
    where: {
      OR: items.map((n) => ({
        userId: n.userId,
        type: n.type,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
      })),
    },
    select: { userId: true, type: true, relatedEntityType: true, relatedEntityId: true },
  });
  const existingKeys = new Set(existing.map((e) => notificationKey({ ...e, relatedEntityType: e.relatedEntityType ?? "", relatedEntityId: e.relatedEntityId ?? "" })));

  const toCreate = items.filter((n) => !existingKeys.has(notificationKey(n)));
  for (const params of toCreate) {
    const row = await prisma.notification.create({ data: params });
    publishNotificationEvent({ type: "notification", userId: params.userId, notification: toVM(row) });
  }
}

async function scanTasks(now: Date) {
  const soon = new Date(now.getTime() + UPCOMING_WINDOW_MS);

  const overdue = await prisma.task.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: now } },
    select: { id: true, title: true, assignedToId: true },
  });
  await createMissingNotifications(
    overdue.map((t) => ({
      userId: t.assignedToId,
      type: "task_overdue",
      title: "Tarea vencida",
      message: t.title,
      relatedEntityType: "Task",
      relatedEntityId: t.id,
    }))
  );

  const upcoming = await prisma.task.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { gte: now, lte: soon } },
    select: { id: true, title: true, assignedToId: true },
  });
  await createMissingNotifications(
    upcoming.map((t) => ({
      userId: t.assignedToId,
      type: "task_upcoming",
      title: "Tarea por vencer",
      message: t.title,
      relatedEntityType: "Task",
      relatedEntityId: t.id,
    }))
  );
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
  await createMissingNotifications(
    upcoming.map((a) => ({
      userId: a.userId,
      type: "upcoming_appointment",
      title: "Cita próxima",
      message: a.title,
      relatedEntityType: "Appointment",
      relatedEntityId: a.id,
    }))
  );
}

async function scanDocumentationPending(now: Date) {
  const threshold = new Date(now.getTime() - DOC_PENDING_THRESHOLD_MS);
  const pending: PendingNotification[] = [];

  const leads = await prisma.lead.findMany({
    where: { stage: { name: DOC_PENDING_STAGE_NAME } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stageId: true,
      createdAt: true,
      agent: { select: { user: { select: { id: true } } } },
    },
  });

  for (const l of leads) {
    if (!l.agent?.user) continue; // sin agente vinculado a un User, no hay a quién avisarle

    // Momento en que el lead entró a "Documentación pendiente" — el último
    // registro de PipelineHistory con toStageId = etapa actual (todo cambio
    // de etapa queda trazado ahí, ver leads/actions.ts). Si no hay historial
    // (lead creado directamente en esa etapa), se usa su fecha de creación.
    const lastChange = await prisma.pipelineHistory.findFirst({
      where: { entityType: "LEAD", entityId: l.id, toStageId: l.stageId },
      orderBy: { changedAt: "desc" },
      select: { changedAt: true },
    });
    const enteredAt = lastChange?.changedAt ?? l.createdAt;
    if (enteredAt > threshold) continue; // todavía no cumple el umbral de espera

    const daysWaiting = Math.max(1, Math.floor((now.getTime() - enteredAt.getTime()) / (24 * 60 * 60 * 1000)));

    pending.push({
      userId: l.agent.user.id,
      type: "documentation_pending",
      title: "Documentación pendiente",
      message: `${l.firstName} ${l.lastName} lleva ${daysWaiting} día(s) esperando documentación`,
      relatedEntityType: "Lead",
      relatedEntityId: l.id,
    });
  }

  await createMissingNotifications(pending);
}

async function scanTurning65(now: Date) {
  // Fase 15 (auditoría de rendimiento) — antes esto traía TODA la tabla de
  // Client con dob no nulo (crece para siempre) y filtraba la edad en JS.
  // La ventana de "cumple 65 en los próximos N días" corresponde a un rango
  // acotado de fechas de nacimiento exactamente 65 años atrás — se calcula
  // acá y se filtra en el WHERE, así el scan (que corre cada 5 minutos para
  // siempre) escala con la cantidad de gente que cumple años esta ventana,
  // no con el total histórico de clientes.
  const windowStart = new Date(now);
  windowStart.setFullYear(windowStart.getFullYear() - 65);
  const windowEnd = new Date(now.getTime() + TURNING_65_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  windowEnd.setFullYear(windowEnd.getFullYear() - 65);

  const clients = await prisma.client.findMany({
    where: { dob: { gte: windowStart, lte: windowEnd } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      agent: { select: { user: { select: { id: true } } } },
    },
  });

  const pending: PendingNotification[] = [];
  for (const c of clients) {
    if (!c.dob || !c.agent?.user) continue; // sin agente vinculado a un User, no hay a quién avisarle
    const turns65 = new Date(c.dob);
    turns65.setFullYear(turns65.getFullYear() + 65);
    const daysUntil = (turns65.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    if (daysUntil < 0 || daysUntil > TURNING_65_WINDOW_DAYS) continue; // margen fino (meses de 28-31 días) — el WHERE ya acotó lo grueso

    pending.push({
      userId: c.agent.user.id,
      type: "turning_65",
      title: "Cliente cumple 65 años",
      message: `${c.firstName} ${c.lastName} cumple 65 el ${turns65.toLocaleDateString("es-ES")}`,
      relatedEntityType: "Client",
      relatedEntityId: c.id,
    });
  }
  await createMissingNotifications(pending);
}

export async function scanAndGenerateNotifications() {
  const now = new Date();
  try {
    await scanTasks(now);
    await scanAppointments(now);
    await scanTurning65(now);
    await scanDocumentationPending(now);
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
