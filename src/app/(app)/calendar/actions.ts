"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";
import type { AppointmentStatus } from "@prisma/client";

export interface AppointmentActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateAppointmentInput {
  title: string;
  relatedLeadId?: string;
  relatedClientId?: string;
  /** "YYYY-MM-DDTHH:mm" — se guarda como está, sin conversión de zona
   * horaria adicional (igual que el resto del CRM). */
  startsAt: string;
  durationMinutes: number;
}

/** Agenda una cita — siempre en el calendario de quien la crea (userId =
 * sesión actual), igual que createActivityAction. */
export async function createAppointmentAction(input: CreateAppointmentInput): Promise<AppointmentActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "calendar", "create")) {
    return { ok: false, error: "No tienes permiso para crear citas." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "El título es obligatorio." };
  }
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Fecha u hora inválida." };
  }

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (leadId || clientId) {
    const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
    if (ownershipError) return { ok: false, error: ownershipError };
  }

  const appointment = await prisma.appointment.create({
    data: {
      title,
      startsAt,
      durationMinutes: input.durationMinutes || 30,
      userId: user.id,
      leadId,
      clientId,
    },
  });

  revalidatePath("/calendar");
  return { ok: true, id: appointment.id };
}

/** Cambia el estado de una cita (Confirmar / Completar / Cancelar / No se
 * presentó) — mismo criterio de alcance que getAppointmentsForUser. */
const VALID_APPOINTMENT_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus
): Promise<AppointmentActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "calendar", "edit")) {
    return { ok: false, error: "No tienes permiso para editar citas." };
  }
  if (!VALID_APPOINTMENT_STATUSES.includes(status)) {
    return { ok: false, error: "Estado de cita inválido." };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { lead: true, client: true },
  });
  if (!appointment) return { ok: false, error: "La cita ya no existe." };

  const viewAll = canViewAll(user);
  const owns =
    viewAll ||
    appointment.userId === user.id ||
    appointment.lead?.agentId === user.agentId ||
    appointment.client?.agentId === user.agentId;
  if (!owns) {
    return { ok: false, error: "No puedes editar una cita que no es tuya." };
  }

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });

  revalidatePath("/calendar");
  return { ok: true };
}
