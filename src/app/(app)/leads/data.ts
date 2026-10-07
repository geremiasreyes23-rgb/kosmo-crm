import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { Lead as LeadVM, PipelineStage as StageVM } from "@/types";
import type { FieldDef, FieldType } from "@/data/customFields";
import { formatLeadCode } from "@/lib/utils";
import { getLeadSensitiveMasked, type LeadSensitiveMaskedVM } from "@/lib/sensitiveData";
import {
  EMPTY_COMMON,
  getLineDef,
  readStoredLineDetails,
  type CommonValues,
  type LineCode,
  type LineValues,
} from "@/lib/leads/lineSchema";

/** Etapas del pipeline real de Leads (sembrado por prisma/seed.ts) — un solo
 * pipeline por defecto para leads, igual que asumía el UI Shell de Fase 1. */
export async function getLeadPipelineStages(): Promise<StageVM[]> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "LEAD", isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return (pipeline?.stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    order: s.order,
    isWon: s.isWon,
    isLost: s.isLost,
  }));
}

function fullName(a: { firstName: string; lastName: string } | null | undefined): string {
  return a ? `${a.firstName} ${a.lastName}` : "Sin asignar";
}

const leadInclude = {
  source: true,
  agent: true,
  aor: true,
  interestedLine: true,
  customFieldValues: { include: { customField: true } },
} satisfies Prisma.LeadInclude;

type LeadRow = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

function mapLead(row: LeadRow): LeadVM {
  const customFieldValues: Record<string, string> = {};
  for (const v of row.customFieldValues) {
    if (v.value != null && v.value !== "") customFieldValues[v.customField.name] = v.value;
  }
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    state: row.state ?? undefined,
    source: row.source?.name ?? "Sin origen",
    agentName: fullName(row.agent),
    stageId: row.stageId,
    createdAt: row.createdAt.toISOString().slice(0, 10),
    lastContactAt: row.lastContactAt ? row.lastContactAt.toISOString().slice(0, 10) : undefined,
    nextFollowUpAt: row.nextFollowUpAt ? row.nextFollowUpAt.toISOString().slice(0, 10) : undefined,
    productLine: row.interestedLine?.name ?? undefined,
    customFieldValues: Object.keys(customFieldValues).length ? customFieldValues : undefined,
    convertedClientId: row.convertedClientId ?? undefined,
    convertedAt: row.convertedAt ? row.convertedAt.toISOString().slice(0, 10) : undefined,
    leadCode: formatLeadCode(row.leadNumber),
    agentId: row.agentId ?? undefined,
    aorId: row.aorId ?? undefined,
    submissionStatus: row.submissionStatus ?? undefined,
    dob: row.dob ? row.dob.toISOString().slice(0, 10) : undefined,
    address: row.address ?? undefined,
    zipCode: row.zipCode ?? undefined,
    county: row.county ?? undefined,
    preferredLanguage: row.preferredLanguage ?? undefined,
    aorName: row.aor ? `${row.aor.firstName} ${row.aor.lastName}` : undefined,
    lineCode: getLineDef(row.interestedLine?.code)?.code,
  };
}

/** Alcance de datos por rol (sección 7 del brief de arquitectura): sin el
 * permiso "*:view_all" (Agent, en el seed base), un vendedor solo ve los
 * leads que tiene asignados como agente. */
export async function getLeadsForUser(user: SessionUser): Promise<LeadVM[]> {
  const rows = await prisma.lead.findMany({
    where: canViewAll(user) ? undefined : { agentId: user.agentId ?? "__sin-agente__" },
    include: leadInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapLead);
}

/** Un lead individual, con el mismo control de alcance — devuelve null tanto
 * si no existe como si el usuario no tiene permiso de verlo (nunca revela
 * cuál de los dos casos es, para no filtrar existencia de datos ajenos). */
export async function getLeadForUser(id: string, user: SessionUser): Promise<LeadVM | null> {
  const row = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!row) return null;
  if (!canViewAll(user) && row.agentId !== user.agentId) return null;
  return mapLead(row);
}

function mapCustomFieldType(t: string): FieldType {
  switch (t) {
    case "BOOLEAN":
      return "boolean";
    case "SELECT":
    case "MULTISELECT":
      return "select";
    case "NUMBER":
    case "DECIMAL":
      return "number";
    case "TEXTAREA":
      return "textarea";
    default:
      return "text";
  }
}

export interface LeadFormOptions {
  sources: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  /** Agentes marcados como AOR (si no hay ninguno marcado, todos los activos). */
  aors: { id: string; name: string }[];
  /** code = InsuranceLine.code; lineCode = definición de campos propia (o null). */
  insuranceLines: { id: string; name: string; code: string; lineCode: LineCode | null }[];
  /** Carriers activos por línea de negocio (clave: InsuranceLine.id). Si una
   * línea no tiene carriers asociados, se ofrecen todos los activos. */
  carriersByLine: Record<string, { id: string; name: string }[]>;
  /** Campos dinámicos que aparecen solo cuando el lead marca interés en esa
   * línea de negocio — clave: InsuranceLine.id. */
  fieldsByLine: Record<string, FieldDef[]>;
  /** Catálogo de campos opcionales que se agregan a mano con "+ Agregar campo". */
  extraFields: FieldDef[];
}

/** Catálogos vivos para el formulario "Nuevo lead" — reemplaza los arrays
 * fijos de src/data/customFields.ts, que ahora solo documentan la forma. */
export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  const [sources, agents, lines, customFields, carriers] = await Promise.all([
    prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
    prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
    prisma.insuranceLine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customField.findMany({ where: { entityType: "LEAD", isVisible: true }, orderBy: { order: "asc" } }),
    prisma.carrier.findMany({ where: { status: "ACTIVE" }, include: { lines: true }, orderBy: { name: "asc" } }),
  ]);

  const carriersByLine: Record<string, { id: string; name: string }[]> = {};
  for (const line of lines) {
    const linked = carriers.filter((c) => c.lines.some((l) => l.insuranceLineId === line.id));
    carriersByLine[line.id] = (linked.length ? linked : carriers).map((c) => ({ id: c.id, name: c.name }));
  }
  const toOption = (a: { id: string; firstName: string; lastName: string }) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
  });
  const flaggedAors = agents.filter((a) => a.isAor);

  const fieldsByLine: Record<string, FieldDef[]> = {};
  const extraFields: FieldDef[] = [];
  for (const cf of customFields) {
    const def: FieldDef = {
      key: cf.name,
      label: cf.label,
      type: mapCustomFieldType(cf.fieldType),
      options: Array.isArray(cf.options) ? (cf.options as string[]) : undefined,
    };
    if (cf.insuranceLineId) {
      (fieldsByLine[cf.insuranceLineId] ??= []).push(def);
    } else {
      extraFields.push(def);
    }
  }

  return {
    sources: sources.map((s) => ({ id: s.id, name: s.name })),
    agents: agents.map(toOption),
    aors: (flaggedAors.length ? flaggedAors : agents).map(toOption),
    insuranceLines: lines.map((l) => ({ id: l.id, name: l.name, code: l.code, lineCode: getLineDef(l.code)?.code ?? null })),
    carriersByLine,
    fieldsByLine,
    extraFields,
  };
}

/** Todo lo que el formulario necesita para editar un lead existente. */
export interface LeadEditData {
  leadId: string;
  leadCode: string;
  createdAt: string;
  common: CommonValues;
  lineId: string;
  lineValues: LineValues | null;
  /** Datos restringidos guardados — solo enmascarados, nunca el valor real. */
  sensitive: LeadSensitiveMaskedVM[];
  customFieldValues: Record<string, string>;
}

export async function getLeadEditData(id: string, user: SessionUser): Promise<LeadEditData | null> {
  const row = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!row) return null;
  if (!canViewAll(user) && row.agentId !== user.agentId) return null;
  const lineCode = getLineDef(row.interestedLine?.code)?.code ?? null;
  const customFieldValues: Record<string, string> = {};
  for (const v of row.customFieldValues) {
    if (v.value != null && v.value !== "") customFieldValues[v.customField.name] = v.value;
  }
  return {
    leadId: row.id,
    leadCode: formatLeadCode(row.leadNumber),
    createdAt: row.createdAt.toISOString(),
    common: {
      ...EMPTY_COMMON,
      firstName: row.firstName,
      lastName: row.lastName,
      dob: row.dob ? row.dob.toISOString().slice(0, 10) : "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      zipCode: row.zipCode ?? "",
      county: row.county ?? "",
      state: row.state ?? "",
      preferredLanguage: row.preferredLanguage ?? "",
      sourceId: row.sourceId ?? "",
      agentId: row.agentId ?? "",
      aorId: row.aorId ?? "",
    },
    lineId: row.interestedLineId ?? "",
    lineValues: readStoredLineDetails(row.lineDetails, lineCode),
    sensitive: await getLeadSensitiveMasked(row.id),
    customFieldValues,
  };
}
