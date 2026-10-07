"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission, type SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { canSeePath } from "@/lib/visibility-server";
import { computeHiddenKeys } from "@/lib/visibility";
import {
  getLineDef,
  readStoredLineDetails,
  sanitizeLineValues,
  submissionFieldDefs,
  validateLead,
  EMPTY_COMMON,
  type LineValues,
} from "@/lib/leads/lineSchema";

/**
 * Envíos (submisiones). Flujo:
 *   1. Desde la ficha del lead, el vendedor lo manda a la cola ("Enviar a
 *      Envíos") → submissionStatus = PENDING y se avisa a quienes ven el
 *      panel Envíos.
 *   2. Quien somete la solicitud (solo quien tiene visible el módulo Envíos)
 *      llena los campos de envío de la línea y marca Sometido / Aprobado /
 *      Rechazado. Cada cambio de estado avisa al vendedor del lead.
 */

export interface SubmissionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING: "pendiente",
  SUBMITTED: "sometido",
  APPROVED: "aprobado",
  REJECTED: "rechazado",
};

/** Usuarios activos que tienen visible el módulo Envíos (rol o excepción). */
async function submissionUserIds(excludeUserId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: excludeUserId } },
    select: {
      id: true,
      roleId: true,
      role: { select: { name: true } },
      visibilityOverrides: { where: { key: "module:/submissions" }, select: { key: true, visible: true } },
    },
  });
  const roleRows = await prisma.roleModuleVisibility.findMany({
    where: { moduleKey: "/submissions", visible: true },
    select: { roleId: true },
  });
  const rolesWithModule = new Set(roleRows.map((r) => r.roleId));
  return users
    .filter((u) => {
      const hidden = computeHiddenKeys(
        rolesWithModule.has(u.roleId) ? new Set<string>(["/submissions"]) : new Set<string>(),
        Object.fromEntries(u.visibilityOverrides.map((o) => [o.key, o.visible])),
        u.role.name === "Super Admin"
      );
      return !hidden.includes("module:/submissions");
    })
    .map((u) => u.id);
}

async function requireSubmissionsAccess(): Promise<{ user: SessionUser | null; error?: string }> {
  const user = await requireUser();
  if (!(await canSeePath(user, "/submissions"))) {
    return { user: null, error: "No tienes acceso al panel de Envíos." };
  }
  return { user };
}

/** Vendedor → manda el lead a la cola de Envíos. */
export async function requestSubmissionAction(leadId: string): Promise<SubmissionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "leads", "edit")) return { ok: false, error: "No tienes permiso para editar leads." };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { interestedLine: true } });
  if (!lead) return { ok: false, error: "El lead ya no existe." };
  if (!canViewAll(user) && lead.agentId !== user.agentId) {
    return { ok: false, error: "No puedes enviar leads de otro vendedor." };
  }
  if (!getLineDef(lead.interestedLine?.code)) {
    return { ok: false, error: "Asigna primero una línea de negocio al lead." };
  }
  if (lead.submissionStatus && lead.submissionStatus !== "REJECTED") {
    return { ok: false, error: "Este lead ya está en Envíos." };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      submissionStatus: "PENDING",
      submissionRequestedAt: new Date(),
      submissionRequestedById: user.id,
      submittedAt: null,
      submittedById: null,
    },
  });
  await logAudit({ userId: user.id, action: "UPDATE", entityType: "Lead", entityId: leadId, fieldName: "submissionStatus", newValue: "PENDING" });

  const recipients = await submissionUserIds(user.id);
  await Promise.all(
    recipients.map((id) =>
      notifyUser({
        userId: id,
        type: "submission_requested",
        title: "Nuevo lead para someter",
        message: `${user.firstName} ${user.lastName} envió a ${lead.firstName} ${lead.lastName} (${lead.interestedLine?.name ?? ""}) para someter.`,
        relatedEntityType: "LeadSubmission",
        relatedEntityId: leadId,
      })
    )
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/submissions");
  return { ok: true };
}

/**
 * Quien somete → guarda los campos de envío, las notas y (opcional) cambia
 * el estado. Para marcar Sometido o Aprobado, los campos de envío deben
 * estar completos.
 */
export async function saveSubmissionAction(input: {
  leadId: string;
  values: LineValues;
  notes: string;
  status?: SubmissionStatus;
}): Promise<SubmissionResult> {
  const { user, error } = await requireSubmissionsAccess();
  if (!user) return { ok: false, error };

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { interestedLine: true, agent: { select: { user: { select: { id: true } } } } },
  });
  if (!lead || !lead.submissionStatus) return { ok: false, error: "Este lead no está en Envíos." };
  const def = getLineDef(lead.interestedLine?.code);
  if (!def) return { ok: false, error: "El lead no tiene una línea de negocio con campos propios." };

  // Solo se tocan los campos de envío; el resto de la línea queda igual.
  const stored = readStoredLineDetails(lead.lineDetails, def.code) ?? {};
  const fields = submissionFieldDefs(def.code);
  const merged: Record<string, unknown> = { ...stored };
  for (const { field } of fields) {
    if (field.key in (input.values ?? {})) merged[field.key] = input.values[field.key];
  }
  const values = sanitizeLineValues(def.code, merged);

  if (input.status === "SUBMITTED" || input.status === "APPROVED") {
    // Reutiliza la validación del formulario, pero solo sobre los campos de envío.
    const onlySubmission = new Set<string>();
    for (const section of def.sections) {
      for (const f of section.fields) {
        const isSubmission = fields.some((x) => x.sectionId === section.id && x.field.key === f.key);
        if (!isSubmission) onlySubmission.add(`lead.${def.code}.${section.id}.${f.key}`);
      }
    }
    const all = validateLead({
      common: { ...EMPTY_COMMON, firstName: "x", lastName: "x" },
      lineCode: def.code,
      hasLine: true,
      values,
      sensitiveInputs: {},
      sensitiveSaved: [],
      hidden: new Set([
        ...onlySubmission,
        ...Object.keys(EMPTY_COMMON).map((k) => `lead.common.${k}`),
        "lead.common.sensitive",
      ]),
    });
    const fieldErrors = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("line.")));
    if (Object.keys(fieldErrors).length) {
      return { ok: false, error: "Completa los campos de envío antes de cambiar el estado.", fieldErrors };
    }
  }

  const statusChanged = !!input.status && input.status !== lead.submissionStatus;
  const data: Prisma.LeadUpdateInput = {
    lineDetails: { line: def.code, values } as unknown as Prisma.InputJsonValue,
    submissionNotes: input.notes.trim().slice(0, 2000) || null,
  };
  if (statusChanged && input.status) {
    data.submissionStatus = input.status;
    if (input.status === "SUBMITTED") {
      data.submittedAt = new Date();
      data.submittedBy = { connect: { id: user.id } };
    }
  }
  await prisma.lead.update({ where: { id: lead.id }, data });
  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Lead",
    entityId: lead.id,
    fieldName: statusChanged ? "submissionStatus" : "submission",
    oldValue: statusChanged ? (lead.submissionStatus ?? undefined) : undefined,
    newValue: statusChanged ? input.status : undefined,
  });

  const sellerUserId = lead.agent?.user?.id;
  if (statusChanged && input.status && sellerUserId && sellerUserId !== user.id) {
    await notifyUser({
      userId: sellerUserId,
      type: "submission_updated",
      title: `Envío ${STATUS_LABEL[input.status]}`,
      message: `${lead.firstName} ${lead.lastName}: ${user.firstName} ${user.lastName} marcó el envío como ${STATUS_LABEL[input.status]}.`,
      relatedEntityType: "Lead",
      relatedEntityId: lead.id,
    });
  }

  revalidatePath("/submissions");
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true };
}
