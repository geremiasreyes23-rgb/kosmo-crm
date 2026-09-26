"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export interface LeadActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  state?: string;
  sourceId?: string;
  /** Ignorado si el usuario no tiene permiso de ver/asignar todo el negocio
   * — en ese caso el lead siempre se asigna a sí mismo. */
  agentId?: string;
  stageId: string;
  interestedLineId?: string;
  /** clave = CustomField.name */
  customFieldValues?: Record<string, string>;
}

export async function createLeadAction(input: CreateLeadInput): Promise<LeadActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "leads", "create")) {
    return { ok: false, error: "No tienes permiso para crear leads." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false, error: "Nombre y apellido son obligatorios." };
  }
  if (!input.stageId) {
    return { ok: false, error: "Selecciona una etapa inicial." };
  }

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "La etapa seleccionada ya no existe." };

  // Un vendedor sin alcance "ver todo" solo puede asignarse leads a sí mismo
  // — se ignora silenciosamente cualquier otro agentId que llegue del
  // formulario (nunca confiar en que la UI ocultó el selector).
  const agentId = canViewAll(user) ? input.agentId || null : user.agentId;

  const lead = await prisma.lead.create({
    data: {
      firstName,
      lastName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      state: input.state?.trim() || null,
      sourceId: input.sourceId || null,
      agentId,
      interestedLineId: input.interestedLineId || null,
      pipelineId: stage.pipelineId,
      stageId: stage.id,
    },
  });

  const entries = Object.entries(input.customFieldValues ?? {}).filter(
    ([, v]) => v != null && v !== ""
  );
  if (entries.length) {
    const fields = await prisma.customField.findMany({
      where: { entityType: "LEAD", name: { in: entries.map(([k]) => k) } },
    });
    const byName = new Map(fields.map((f) => [f.name, f]));
    const rows = entries
      .filter(([k]) => byName.has(k))
      .map(([k, v]) => ({ customFieldId: byName.get(k)!.id, leadId: lead.id, value: v }));
    if (rows.length) await prisma.customFieldValue.createMany({ data: rows });
  }

  await prisma.pipelineHistory.create({
    data: { entityType: "LEAD", entityId: lead.id, toStageId: stage.id, changedById: user.id },
  });
  await logAudit({ userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id });

  revalidatePath("/leads");
  return { ok: true, id: lead.id };
}

/** Cambio de etapa — incluido el arrastrar y soltar en el Kanban. Todo
 * cambio de etapa pasa por aquí y queda trazado en PipelineHistory (sección
 * 8 del brief de arquitectura), sin importar desde qué vista se dispare. */
export async function moveLeadStageAction(leadId: string, newStageId: string): Promise<LeadActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "leads", "edit")) {
    return { ok: false, error: "No tienes permiso para mover leads de etapa." };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "El lead ya no existe." };
  if (!canViewAll(user) && lead.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar leads de otro vendedor." };
  }
  if (lead.stageId === newStageId) return { ok: true };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: newStageId } });
  if (!stage) return { ok: false, error: "La etapa seleccionada ya no existe." };

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { stageId: newStageId, lastContactAt: new Date() },
    }),
    prisma.pipelineHistory.create({
      data: {
        entityType: "LEAD",
        entityId: leadId,
        fromStageId: lead.stageId,
        toStageId: newStageId,
        changedById: user.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STAGE_CHANGE",
        entityType: "Lead",
        entityId: leadId,
        fieldName: "stageId",
        oldValue: lead.stageId,
        newValue: newStageId,
      },
    }),
  ]);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export interface ConvertLeadResult {
  ok: boolean;
  error?: string;
  clientId?: string;
}

/**
 * Lead → Cliente (sección 6.B del brief de arquitectura): crea un Client
 * copiando los datos del lead, y marca Lead.convertedClientId/convertedAt
 * — nunca al revés. Las Activities/Tasks/Appointments/Documents/Notes
 * existentes quedan donde estaban, ligadas al leadId original (no se
 * duplican ni se mueven): el historial de cómo se originó el cliente sigue
 * viéndose desde el lead.
 */
export async function convertLeadToClientAction(leadId: string): Promise<ConvertLeadResult> {
  const user = await requireUser();
  if (!hasPermission(user, "clients", "create")) {
    return { ok: false, error: "No tienes permiso para convertir leads a clientes." };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "El lead ya no existe." };
  if (!canViewAll(user) && lead.agentId !== user.agentId) {
    return { ok: false, error: "No puedes convertir leads de otro vendedor." };
  }

  // Idempotente — si ya se convirtió antes, devuelve el cliente existente en
  // vez de crear uno duplicado (doble clic, dos pestañas abiertas, etc.).
  if (lead.convertedClientId) {
    return { ok: true, clientId: lead.convertedClientId };
  }

  // Fase 15 (auditoría de seguridad) — el check de arriba (lead.convertedClientId)
  // se hizo ANTES de esta transacción, así que dos conversiones concurrentes
  // (doble clic, dos pestañas) podían pasarlo ambas y crear dos Client
  // duplicados para el mismo lead. El updateMany condicional de abajo
  // (WHERE convertedClientId IS NULL) es la parte que realmente lo evita:
  // bajo Postgres, la segunda transacción queda bloqueada en ese UPDATE
  // hasta que la primera confirma, y al reevaluar la condición ya no
  // coincide (count === 0) — ahí se descarta (rollback) el Client duplicado
  // que esa segunda transacción alcanzó a crear.
  let client;
  try {
    client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          dob: lead.dob,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          zipCode: lead.zipCode,
          county: lead.county,
          state: lead.state,
          preferredLanguage: lead.preferredLanguage,
          sourceId: lead.sourceId,
          agentId: lead.agentId,
          aorId: lead.aorId,
        },
      });
      const claimed = await tx.lead.updateMany({
        where: { id: leadId, convertedClientId: null },
        data: { convertedClientId: created.id, convertedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error("LEAD_ALREADY_CONVERTED");
      }
      await logAudit(
        { userId: user.id, action: "CREATE", entityType: "Client", entityId: created.id, fieldName: "convertedFromLeadId", newValue: leadId },
        tx
      );
      return created;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "LEAD_ALREADY_CONVERTED") {
      const fresh = await prisma.lead.findUnique({ where: { id: leadId }, select: { convertedClientId: true } });
      if (fresh?.convertedClientId) {
        return { ok: true, clientId: fresh.convertedClientId };
      }
    }
    throw err;
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/clients");
  return { ok: true, clientId: client.id };
}
