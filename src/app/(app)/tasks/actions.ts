"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";
import { recordTaskCompletedFeedEvent } from "@/lib/feed/systemEvents";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export interface TaskActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  relatedLeadId?: string;
  relatedClientId?: string;
  /** Ignorado si el usuario no tiene alcance "ver todo" — la tarea siempre
   * se asigna a sí mismo en ese caso (mismo patrón que agentId en
   * createLeadAction/createClientAction). */
  assignedToId?: string;
  dueDate?: string;
  priority?: TaskPriority;
}

export async function createTaskAction(input: CreateTaskInput): Promise<TaskActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "tasks", "create")) {
    return { ok: false, error: "No tienes permiso para crear tareas." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "El título es obligatorio." };
  }

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (leadId || clientId) {
    const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
    if (ownershipError) return { ok: false, error: ownershipError };
  }

  const assignedToId = canViewAll(user) && input.assignedToId ? input.assignedToId : user.id;

  const task = await prisma.task.create({
    data: {
      title,
      description: input.description?.trim() || null,
      leadId,
      clientId,
      assignedToId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority ?? "MEDIUM",
    },
  });

  revalidatePath("/tasks");
  return { ok: true, id: task.id };
}

/** Cambia el estado de una tarea (ej. "Marcar completada") — exige ser el
 * asignado, tener alcance "ver todo", o que la tarea esté ligada a un
 * lead/cliente propio (mismo criterio de alcance que getTasksForUser). */
const VALID_TASK_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export async function updateTaskStatusAction(taskId: string, status: TaskStatus): Promise<TaskActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "tasks", "edit")) {
    return { ok: false, error: "No tienes permiso para editar tareas." };
  }
  if (!VALID_TASK_STATUSES.includes(status)) {
    return { ok: false, error: "Estado de tarea inválido." };
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { lead: true, client: true } });
  if (!task) return { ok: false, error: "La tarea ya no existe." };

  const viewAll = canViewAll(user);
  const owns =
    viewAll ||
    task.assignedToId === user.id ||
    task.lead?.agentId === user.agentId ||
    task.client?.agentId === user.agentId;
  if (!owns) {
    return { ok: false, error: "No puedes editar una tarea que no es tuya." };
  }

  await prisma.task.update({ where: { id: taskId }, data: { status } });

  // Feed de Actividades (sección 12/21 del spec) — publica "Tarea
  // finalizada" cuando corresponde. Aislado en su propio módulo y nunca
  // lanza (ver recordTaskCompletedFeedEvent), así que no puede romper esta
  // acción aunque falle.
  if (status === "COMPLETED") {
    await recordTaskCompletedFeedEvent({ taskId: task.id, taskTitle: task.title, userId: user.id });
  }

  revalidatePath("/tasks");
  return { ok: true };
}
