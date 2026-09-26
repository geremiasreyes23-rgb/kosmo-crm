import "server-only";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Publicaciones de sistema del Feed ("Nuevo cliente registrado", "Venta
 * completada", "Usuario se unió") — módulo aislado a propósito: NO se
 * agrega ningún hook a leads/clients/sales/settings-users-actions para
 * generarlas. En vez de eso, syncSystemEventsFromAuditLog() lee el AuditLog
 * que esos módulos YA escriben (ver src/lib/audit.ts, Fase 13) y crea el
 * FeedPost equivalente la primera vez que alguien abre el Feed después de
 * ese evento. sourceAuditLogId (único en FeedPost) evita procesarlo dos
 * veces; createMany({skipDuplicates:true}) lo hace además seguro ante dos
 * cargas simultáneas del Feed.
 *
 * La única excepción real es "Tarea finalizada": Tasks no pasa por
 * AuditLog, así que acá sí hay un hook de una línea en
 * tasks/actions.ts → updateTaskStatusAction (ver recordTaskCompletedFeedEvent
 * más abajo), aprobado explícitamente para este caso.
 */

const SYNC_WINDOW_DAYS = 90;
const SYNC_BATCH_SIZE = 200;

function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

export async function syncSystemEventsFromAuditLog(): Promise<void> {
  const since = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Fase 15 (auditoría de rendimiento) — antes esto traía TODOS los
  // FeedPost de sistema jamás creados, sin límite, en cada carga del Feed
  // (crece para siempre con la vida de la agencia). Ahora se acota a los
  // ids candidatos de esta tanda: basta para saber cuáles de ESOS ya están
  // procesados.
  const candidates = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: since },
      action: "CREATE",
      entityType: { in: ["Client", "Sale", "User"] },
    },
    orderBy: { createdAt: "asc" },
    take: SYNC_BATCH_SIZE,
  });
  if (candidates.length === 0) return;

  const candidateIds = candidates.map((c) => c.id);
  const alreadyProcessed = await prisma.feedPost.findMany({
    where: { sourceAuditLogId: { in: candidateIds } },
    select: { sourceAuditLogId: true },
  });

  const processedIds = new Set(alreadyProcessed.map((p) => p.sourceAuditLogId));
  const pending = candidates.filter((row) => !processedIds.has(row.id));
  if (pending.length === 0) return;

  const clientIds = pending.filter((r) => r.entityType === "Client").map((r) => r.entityId);
  const saleIds = pending.filter((r) => r.entityType === "Sale").map((r) => r.entityId);
  const newUserIds = pending.filter((r) => r.entityType === "User").map((r) => r.entityId);
  const actorIds = Array.from(new Set(pending.map((r) => r.userId)));

  const [clients, sales, newUsers, actors] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    saleIds.length
      ? prisma.sale.findMany({
          where: { id: { in: saleIds } },
          select: { id: true, premium: true, clientId: true, client: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    newUserIds.length
      ? prisma.user.findMany({ where: { id: { in: newUserIds } }, select: { id: true, firstName: true, lastName: true, department: true } })
      : Promise.resolve([]),
    actorIds.length
      ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
  ]);

  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const salesById = new Map(sales.map((s) => [s.id, s]));
  const newUsersById = new Map(newUsers.map((u) => [u.id, u]));
  const actorsById = new Map(actors.map((u) => [u.id, u]));

  const data: Prisma.FeedPostCreateManyInput[] = [];

  for (const row of pending) {
    const actor = actorsById.get(row.userId);
    const actorName = actor ? fullName(actor) : "Alguien";

    if (row.entityType === "Client") {
      const client = clientsById.get(row.entityId);
      const clientName = client ? fullName(client) : "un nuevo cliente";
      data.push({
        authorId: row.userId,
        kind: "SYSTEM",
        systemEventType: "CLIENT_CREATED",
        systemEventData: { actorName, clientName },
        systemEntityType: "Client",
        systemEntityId: row.entityId,
        sourceAuditLogId: row.id,
        audience: "EVERYONE",
        createdAt: row.createdAt,
      });
    } else if (row.entityType === "Sale") {
      const sale = salesById.get(row.entityId);
      const clientName = sale?.client ? fullName(sale.client) : undefined;
      const amountLabel = sale?.premium ? formatCurrency(sale.premium) : undefined;
      data.push({
        authorId: row.userId,
        kind: "SYSTEM",
        systemEventType: "SALE_CREATED",
        systemEventData: { actorName, clientName: clientName ?? null, amountLabel: amountLabel ?? null },
        systemEntityType: sale?.clientId ? "Client" : undefined,
        systemEntityId: sale?.clientId ?? undefined,
        sourceAuditLogId: row.id,
        audience: "EVERYONE",
        createdAt: row.createdAt,
      });
    } else if (row.entityType === "User") {
      const newUser = newUsersById.get(row.entityId);
      const newUserName = newUser ? fullName(newUser) : "Un nuevo integrante";
      data.push({
        authorId: row.entityId,
        kind: "SYSTEM",
        systemEventType: "USER_JOINED",
        systemEventData: { newUserName, department: newUser?.department ?? null },
        systemEntityType: "User",
        systemEntityId: row.entityId,
        sourceAuditLogId: row.id,
        audience: "EVERYONE",
        createdAt: row.createdAt,
      });
    }
  }

  if (data.length > 0) {
    await prisma.feedPost.createMany({ data, skipDuplicates: true });
  }
}

/** Hook mínimo llamado desde tasks/actions.ts → updateTaskStatusAction al
 * marcar una tarea como COMPLETED. Nunca lanza — igual que logAudit, una
 * falla acá no debe romper la acción real de completar la tarea. */
export async function recordTaskCompletedFeedEvent(params: {
  taskId: string;
  taskTitle: string;
  userId: string;
}): Promise<void> {
  try {
    const existing = await prisma.feedPost.findFirst({
      where: { systemEventType: "TASK_COMPLETED", systemEntityId: params.taskId },
      select: { id: true },
    });
    if (existing) return;

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { firstName: true, lastName: true },
    });
    const userName = user ? fullName(user) : "Alguien";

    await prisma.feedPost.create({
      data: {
        authorId: params.userId,
        kind: "SYSTEM",
        systemEventType: "TASK_COMPLETED",
        systemEventData: { userName, taskTitle: params.taskTitle },
        systemEntityType: "Task",
        systemEntityId: params.taskId,
        audience: "EVERYONE",
      },
    });
  } catch (err) {
    console.error("[feed] no se pudo registrar el evento de tarea completada:", err);
  }
}
