import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { Lead as LeadVM, PipelineStage as StageVM } from "@/types";
import type { FieldDef, FieldType } from "@/data/customFields";

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
  insuranceLines: { id: string; name: string }[];
  /** Campos dinámicos que aparecen solo cuando el lead marca interés en esa
   * línea de negocio — clave: InsuranceLine.id. */
  fieldsByLine: Record<string, FieldDef[]>;
  /** Catálogo de campos opcionales que se agregan a mano con "+ Agregar campo". */
  extraFields: FieldDef[];
}

/** Catálogos vivos para el formulario "Nuevo lead" — reemplaza los arrays
 * fijos de src/data/customFields.ts, que ahora solo documentan la forma. */
export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  const [sources, agents, lines, customFields] = await Promise.all([
    prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
    prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
    prisma.insuranceLine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customField.findMany({ where: { entityType: "LEAD", isVisible: true }, orderBy: { order: "asc" } }),
  ]);

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
    agents: agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
    insuranceLines: lines.map((l) => ({ id: l.id, name: l.name })),
    fieldsByLine,
    extraFields,
  };
}
