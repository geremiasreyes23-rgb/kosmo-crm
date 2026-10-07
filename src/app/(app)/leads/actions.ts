"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type Lead as LeadModel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission, type SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  archiveLeadSensitiveFields,
  revealSensitiveField,
  upsertLeadSensitiveField,
} from "@/lib/sensitiveData";
import {
  EMPTY_COMMON,
  allowedSensitiveKeys,
  getLineDef,
  parseYmd,
  sanitizeLineValues,
  validateLead,
  type CommonValues,
  type FieldErrors,
  type LineCode,
  type LineValues,
} from "@/lib/leads/lineSchema";
import { copyLeadDataToClient } from "@/lib/leads/conversion";
import { getUserVisibility } from "@/lib/visibility-server";
import { LINE_DEFS, noneKey, readStoredLineDetails } from "@/lib/leads/lineSchema";

export interface LeadActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface LeadFormPayload {
  /** Cliente Común — siempre presente, independiente de la línea. */
  common: CommonValues;
  /** InsuranceLine.id de la línea de negocio seleccionada. */
  lineId: string;
  /** Campos de la línea seleccionada (se sanean en el servidor). */
  lineValues: LineValues;
  /** Datos restringidos NUEVOS escritos en el formulario (clave → valor en
   * texto plano, solo viaja una vez y se cifra antes de guardarse). */
  sensitive: Record<string, string>;
  /** clave = CustomField.name */
  customFieldValues?: Record<string, string>;
  /** Nota inicial / nueva nota (se agrega al historial de Notas). */
  note?: string;
  /** Solo al crear: etapa inicial del pipeline. */
  stageId?: string;
}

export interface LeadFormResult extends LeadActionResult {
  fieldErrors?: FieldErrors;
}

function ymdToDate(ymd: string | undefined | null): Date | null {
  return ymd && parseYmd(ymd) ? new Date(`${ymd.slice(0, 10)}T00:00:00Z`) : null;
}

type PreparedLead =
  | { ok: false; result: LeadFormResult }
  | {
      ok: true;
      common: CommonValues;
      agentId: string | null;
      line: { id: string; code: string; name: string };
      lineCode: LineCode | null;
      values: LineValues;
      sensitive: Record<string, string>;
      allowedSensitive: Set<string>;
    };

/**
 * Valida y normaliza un payload de Lead con las MISMAS reglas que el
 * formulario (src/lib/leads/lineSchema.ts): Cliente Común siempre, más los
 * campos de la línea de negocio seleccionada — y solo esa. Cualquier clave
 * de otra línea se descarta aquí, nunca llega a la base de datos.
 */
async function prepareLead(
  user: SessionUser,
  payload: LeadFormPayload,
  existingLeadId: string | null
): Promise<PreparedLead> {
  const fail = (error: string, fieldErrors?: FieldErrors): PreparedLead => ({
    ok: false,
    result: { ok: false, error, fieldErrors },
  });

  // Visibilidad por persona: lo que este usuario no ve no se valida ni se
  // pisa — al editar se conserva el valor guardado (src/lib/visibility.ts).
  const { hidden } = await getUserVisibility(user);
  const existing = existingLeadId ? await prisma.lead.findUnique({ where: { id: existingLeadId } }) : null;

  const raw = payload.common ?? EMPTY_COMMON;
  const common: CommonValues = { ...EMPTY_COMMON };
  for (const key of Object.keys(EMPTY_COMMON) as (keyof CommonValues)[]) {
    if (hidden.has(`lead.common.${key}`)) {
      common[key] = existing ? existingCommonValue(existing, key) : "";
      continue;
    }
    common[key] = typeof raw[key] === "string" ? raw[key].trim().slice(0, 300) : "";
  }
  // Un vendedor sin alcance "ver todo" solo puede asignarse leads a sí mismo
  // — se ignora cualquier otro agentId que llegue del formulario.
  const agentId = canViewAll(user) ? common.agentId || null : user.agentId;
  common.agentId = agentId ?? "";

  const line = payload.lineId
    ? await prisma.insuranceLine.findUnique({ where: { id: payload.lineId } })
    : null;
  if (payload.lineId && !line) return fail("La línea de negocio seleccionada ya no existe.");
  const lineCode = getLineDef(line?.code)?.code ?? null;
  let lineInput: Record<string, unknown> = { ...((payload.lineValues ?? {}) as Record<string, unknown>) };
  if (lineCode) {
    const stored =
      existing && existing.interestedLineId === line?.id ? readStoredLineDetails(existing.lineDetails, lineCode) : null;
    for (const section of LINE_DEFS[lineCode].sections) {
      for (const f of section.fields) {
        if (!hidden.has(`lead.${lineCode}.${section.id}.${f.key}`)) continue;
        lineInput[f.key] = stored?.[f.key];
        if (f.kind === "list") lineInput[noneKey(f.key)] = stored?.[noneKey(f.key)];
      }
    }
  } else {
    lineInput = {};
  }
  const values = lineCode ? sanitizeLineValues(lineCode, lineInput) : {};

  const allowedSensitive = allowedSensitiveKeys(lineCode, values);
  const sensitive: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.sensitive ?? {})) {
    if (hidden.has(sensitiveVisibilityKey(lineCode, k))) continue;
    if (allowedSensitive.has(k) && typeof v === "string" && v.trim()) sensitive[k] = v.trim().slice(0, 200);
  }
  const saved = existingLeadId
    ? (
        await prisma.sensitiveField.findMany({
          where: { leadId: existingLeadId, fieldKey: { in: Array.from(allowedSensitive) } },
          select: { fieldKey: true },
        })
      ).map((r) => r.fieldKey)
    : [];

  const fieldErrors = validateLead({
    common,
    lineCode,
    hasLine: !!line,
    values,
    sensitiveInputs: sensitive,
    sensitiveSaved: saved,
    hidden,
  });
  if (!canViewAll(user) && !agentId) {
    fieldErrors["common.agentId"] = "Tu usuario no tiene un vendedor asociado. Pide a un administrador que lo vincule.";
  }

  // Referencias a catálogos: que existan de verdad.
  const [source, agent, aor] = await Promise.all([
    common.sourceId ? prisma.leadSource.findUnique({ where: { id: common.sourceId } }) : null,
    agentId ? prisma.agent.findUnique({ where: { id: agentId } }) : null,
    common.aorId ? prisma.agent.findUnique({ where: { id: common.aorId } }) : null,
  ]);
  if (common.sourceId && !source) fieldErrors["common.sourceId"] = "El origen seleccionado ya no existe.";
  if (agentId && !agent) fieldErrors["common.agentId"] = "El vendedor seleccionado ya no existe.";
  if (common.aorId && !aor) fieldErrors["common.aorId"] = "El AOR seleccionado ya no existe.";
  const carrierId = typeof values.carrierId === "string" ? values.carrierId : "";
  if (carrierId && !(await prisma.carrier.findUnique({ where: { id: carrierId } }))) {
    fieldErrors["line.carrierId"] = "El carrier seleccionado ya no existe.";
  }

  const count = Object.keys(fieldErrors).length;
  if (count) {
    return fail(
      count === 1 ? "Revisa el campo marcado." : `Revisa los ${count} campos marcados.`,
      fieldErrors
    );
  }

  return { ok: true, common, agentId, line: line!, lineCode, values, sensitive, allowedSensitive };
}

/** Valor guardado de un campo de Cliente Común (para conservar lo oculto). */
function existingCommonValue(row: LeadModel, key: keyof CommonValues): string {
  if (key === "dob") return row.dob ? row.dob.toISOString().slice(0, 10) : "";
  const v = (row as unknown as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

/** Clave de visibilidad de un dato restringido del lead. */
function sensitiveVisibilityKey(code: LineCode | null, sensitiveKey: string): string {
  const parts = sensitiveKey.split(".");
  if (parts.length === 1 || !code || parts[0] !== code) return "lead.common.sensitive";
  const fieldKey = parts[1];
  const section = LINE_DEFS[code].sections.find((s) => s.fields.some((f) => f.key === fieldKey));
  return section ? `lead.${code}.${section.id}.${fieldKey}` : "lead.common.sensitive";
}

function leadColumns(p: Extract<PreparedLead, { ok: true }>) {
  const c = p.common;
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    dob: ymdToDate(c.dob),
    phone: c.phone || null,
    email: c.email || null,
    address: c.address || null,
    zipCode: c.zipCode || null,
    county: c.county || null,
    state: c.state || null,
    preferredLanguage: c.preferredLanguage || null,
    sourceId: c.sourceId || null,
    agentId: p.agentId,
    aorId: c.aorId || null,
    interestedLineId: p.line.id,
    lineDetails: p.lineCode
      ? ({ line: p.lineCode, values: p.values } as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
  };
}

/** Guarda los valores de campos personalizados. Solo se aceptan campos
 * globales o de la línea activa; los de otras líneas se eliminan. */
async function saveCustomFieldValues(
  tx: Prisma.TransactionClient,
  leadId: string,
  lineId: string,
  input: Record<string, string> | undefined
) {
  const fields = await tx.customField.findMany({ where: { entityType: "LEAD" } });
  const allowed = fields.filter((f) => !f.insuranceLineId || f.insuranceLineId === lineId);
  const otherLine = fields.filter((f) => f.insuranceLineId && f.insuranceLineId !== lineId);
  if (otherLine.length) {
    await tx.customFieldValue.deleteMany({
      where: { leadId, customFieldId: { in: otherLine.map((f) => f.id) } },
    });
  }
  for (const f of allowed) {
    if (!input || !(f.name in input)) continue;
    const value = String(input[f.name] ?? "").trim();
    await tx.customFieldValue.deleteMany({ where: { leadId, customFieldId: f.id } });
    if (value) await tx.customFieldValue.create({ data: { leadId, customFieldId: f.id, value } });
  }
}

export async function createLeadAction(payload: LeadFormPayload): Promise<LeadFormResult> {
  const user = await requireUser();
  if (!hasPermission(user, "leads", "create")) {
    return { ok: false, error: "No tienes permiso para crear leads." };
  }
  if (!payload.stageId) {
    return { ok: false, error: "Selecciona una etapa inicial." };
  }
  const stage = await prisma.pipelineStage.findUnique({ where: { id: payload.stageId } });
  if (!stage) return { ok: false, error: "La etapa seleccionada ya no existe." };

  const prepared = await prepareLead(user, payload, null);
  if (!prepared.ok) return prepared.result;

  const lead = await prisma.$transaction(
    async (tx) => {
      const created = await tx.lead.create({
        data: { ...leadColumns(prepared), pipelineId: stage.pipelineId, stageId: stage.id },
      });
      for (const [key, value] of Object.entries(prepared.sensitive)) {
        await upsertLeadSensitiveField(tx, created.id, key, value);
      }
      await saveCustomFieldValues(tx, created.id, prepared.line.id, payload.customFieldValues);
      const note = payload.note?.trim();
      if (note) await tx.note.create({ data: { body: note.slice(0, 5000), leadId: created.id } });
      await tx.pipelineHistory.create({
        data: { entityType: "LEAD", entityId: created.id, toStageId: stage.id, changedById: user.id },
      });
      await logAudit({ userId: user.id, action: "CREATE", entityType: "Lead", entityId: created.id }, tx);
      if (Object.keys(prepared.sensitive).length) {
        await logAudit(
          {
            userId: user.id,
            action: "SENSITIVE_ACCESS",
            entityType: "SensitiveField",
            entityId: created.id,
            fieldName: Object.keys(prepared.sensitive).join(", ").slice(0, 300),
          },
          tx
        );
      }
      return created;
    },
    { timeout: 20_000 }
  );

  revalidatePath("/leads");
  return { ok: true, id: lead.id };
}

/**
 * Edición de un lead existente — misma estructura que la creación. Si cambia
 * la línea de negocio, se conserva todo Cliente Común y se reemplazan los
 * campos de línea por los de la nueva (los datos restringidos de la línea
 * anterior se archivan, no se mezclan).
 */
export async function updateLeadAction(leadId: string, payload: LeadFormPayload): Promise<LeadFormResult> {
  const user = await requireUser();
  if (!hasPermission(user, "leads", "edit")) {
    return { ok: false, error: "No tienes permiso para editar leads." };
  }
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) return { ok: false, error: "El lead ya no existe." };
  if (!canViewAll(user) && existing.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar leads de otro vendedor." };
  }

  const prepared = await prepareLead(user, payload, leadId);
  if (!prepared.ok) return prepared.result;

  await prisma.$transaction(
    async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: leadColumns(prepared) });
      for (const [key, value] of Object.entries(prepared.sensitive)) {
        await upsertLeadSensitiveField(tx, leadId, key, value);
      }
      const archived = await archiveLeadSensitiveFields(tx, leadId, prepared.allowedSensitive);
      await saveCustomFieldValues(tx, leadId, prepared.line.id, payload.customFieldValues);
      const note = payload.note?.trim();
      if (note) await tx.note.create({ data: { body: note.slice(0, 5000), leadId } });

      await logAudit({ userId: user.id, action: "UPDATE", entityType: "Lead", entityId: leadId }, tx);
      if (existing.interestedLineId !== prepared.line.id) {
        await logAudit(
          {
            userId: user.id,
            action: "UPDATE",
            entityType: "Lead",
            entityId: leadId,
            fieldName: "interestedLineId",
            oldValue: existing.interestedLineId ?? undefined,
            newValue: prepared.line.id,
          },
          tx
        );
      }
      if (existing.agentId !== prepared.agentId) {
        await logAudit(
          {
            userId: user.id,
            action: "AGENT_CHANGE",
            entityType: "Lead",
            entityId: leadId,
            fieldName: "agentId",
            oldValue: existing.agentId ?? undefined,
            newValue: prepared.agentId ?? undefined,
          },
          tx
        );
      }
      const touched = [...Object.keys(prepared.sensitive), ...archived.map((k) => `archivado ${k}`)];
      if (touched.length) {
        await logAudit(
          {
            userId: user.id,
            action: "SENSITIVE_ACCESS",
            entityType: "SensitiveField",
            entityId: leadId,
            fieldName: touched.join(", ").slice(0, 300),
          },
          tx
        );
      }
    },
    { timeout: 20_000 }
  );

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, id: leadId };
}

export interface RevealLeadSensitiveResult {
  ok: boolean;
  error?: string;
  value?: string;
}

/** Descifra un dato restringido de un lead bajo demanda. Exige
 * "sensitive_data:view" + alcance sobre el lead, y deja registro en
 * SensitiveDataAccessLog. */
export async function revealLeadSensitiveFieldAction(fieldId: string): Promise<RevealLeadSensitiveResult> {
  const user = await requireUser();
  if (!hasPermission(user, "sensitive_data", "view")) {
    return { ok: false, error: "No tienes permiso para ver datos restringidos." };
  }
  const field = await prisma.sensitiveField.findUnique({ where: { id: fieldId }, include: { lead: true } });
  if (!field || !field.lead) return { ok: false, error: "El dato ya no existe." };
  if (!canViewAll(user) && field.lead.agentId !== user.agentId) {
    return { ok: false, error: "No puedes ver datos de leads de otro vendedor." };
  }
  const result = await revealSensitiveField(fieldId, user.id, "Lead");
  if (!result) return { ok: false, error: "El dato ya no existe." };
  return { ok: true, value: result.value };
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

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { interestedLine: true } });
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
      // Lleva los campos de la línea de negocio al perfil correspondiente
      // del cliente (MedicareProfile / ObamacareProfile /
      // FamilyHeritageProfile) y copia los datos restringidos cifrados.
      await copyLeadDataToClient(tx, lead, created.id);
      await logAudit(
        { userId: user.id, action: "CREATE", entityType: "Client", entityId: created.id, fieldName: "convertedFromLeadId", newValue: leadId },
        tx
      );
      return created;
    }, { timeout: 20_000 });
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
