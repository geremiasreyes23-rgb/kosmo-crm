import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { CrmTask } from "@/types";

const taskInclude = {
  assignedTo: true,
  lead: { select: { firstName: true, lastName: true } },
  client: { select: { firstName: true, lastName: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

function mapTask(row: TaskRow): CrmTask {
  const relatedTo = row.lead
    ? `${row.lead.firstName} ${row.lead.lastName}`
    : row.client
      ? `${row.client.firstName} ${row.client.lastName}`
      : "—";
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    relatedTo,
    relatedLeadId: row.leadId ?? undefined,
    relatedClientId: row.clientId ?? undefined,
    assignedTo: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
    assignedToId: row.assignedToId,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
    priority: row.priority,
    status: row.status,
  };
}

/** Alcance: sin "*:view_all", un vendedor ve las tareas asignadas a él, o
 * las ligadas a un lead/cliente suyo (aunque se las haya asignado otra
 * persona, ej. un manager). */
export async function getTasksForUser(
  user: SessionUser,
  filter?: { clientId?: string; leadId?: string }
): Promise<CrmTask[]> {
  const rbacWhere: Prisma.TaskWhereInput | undefined = canViewAll(user)
    ? undefined
    : {
        OR: [
          { assignedToId: user.id },
          { lead: { agentId: user.agentId ?? "__sin-agente__" } },
          { client: { agentId: user.agentId ?? "__sin-agente__" } },
        ],
      };

  const where: Prisma.TaskWhereInput = {
    ...(rbacWhere ?? {}),
    ...(filter?.clientId ? { clientId: filter.clientId } : {}),
    ...(filter?.leadId ? { leadId: filter.leadId } : {}),
  };

  const rows = await prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  return rows.map(mapTask);
}

export interface AssignableUser {
  id: string;
  name: string;
}

/** Catálogo para el selector "Asignado a" — solo tiene sentido mostrarlo
 * cuando el usuario puede asignar a otros (alcance "ver todo"); si no, la
 * tarea siempre se asigna a sí mismo, igual que agentId en Leads/Clientes. */
export async function getAssignableUsers(): Promise<AssignableUser[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });
  return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
}
