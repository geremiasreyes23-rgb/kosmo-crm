import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import { sensitiveFieldLabel } from "@/lib/sensitiveData";
import type { Client as ClientVM } from "@/types";

function fullName(a: { firstName: string; lastName: string } | null | undefined): string {
  return a ? `${a.firstName} ${a.lastName}` : "Sin asignar";
}

/** A diferencia de fullName de arriba, devuelve undefined (no "Sin
 * asignar") cuando no hay AOR — el badge de AOR en la UI solo se muestra si
 * hay un valor, ver clients/[id]/page.tsx. */
function maybeFullName(a: { firstName: string; lastName: string } | null | undefined): string | undefined {
  return a ? `${a.firstName} ${a.lastName}` : undefined;
}

const clientInclude = {
  agent: true,
  aor: true,
  // Lead del que se originó este cliente, si vino de una conversión — ver
  // convertLeadToClientAction en leads/actions.ts y Lead.convertedClientId.
  originLead: { select: { id: true } },
  sensitiveFields: true,
  customFieldValues: { include: { customField: true } },
  policies: { include: { insuranceLine: true, carrier: true, commission: true } },
} satisfies Prisma.ClientInclude;

type ClientRow = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

function mapClient(row: ClientRow, sourceName?: string): ClientVM {
  const customFieldValues: Record<string, string> = {};
  for (const v of row.customFieldValues) {
    if (v.value != null && v.value !== "") customFieldValues[v.customField.name] = v.value;
  }

  const lineNames = new Set(row.policies.map((p) => p.insuranceLine.name));

  return {
    id: row.id,
    clientNumber: row.clientNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    dob: row.dob ? row.dob.toISOString().slice(0, 10) : undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    zipCode: row.zipCode ?? undefined,
    county: row.county ?? undefined,
    state: row.state ?? undefined,
    preferredLanguage: row.preferredLanguage ?? undefined,
    sourceId: row.sourceId ?? undefined,
    sourceName,
    agentId: row.agentId ?? undefined,
    agentName: fullName(row.agent),
    aorId: row.aorId ?? undefined,
    aorName: maybeFullName(row.aor),
    originLeadId: row.originLead?.id,
    createdAt: row.createdAt.toISOString().slice(0, 10),
    activePolicies: row.policies.filter((p) => p.status === "ACTIVE").length,
    linesOfBusiness: Array.from(lineNames),
    customFieldValues: Object.keys(customFieldValues).length ? customFieldValues : undefined,
    sensitiveFields: row.sensitiveFields.map((sf) => ({
      id: sf.id,
      fieldKey: sf.fieldKey,
      label: sensitiveFieldLabel(sf.fieldKey),
      maskedPreview: sf.maskedPreview,
      updatedAt: sf.updatedAt.toISOString(),
    })),
    policies: row.policies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber ?? undefined,
      line: p.insuranceLine.name,
      carrier: p.carrier.name,
      planName: p.planName ?? undefined,
      premium: p.premium ?? undefined,
      status: p.status,
      commission: p.commission
        ? {
            agentAmount: p.commission.agentAmount ?? undefined,
            aorAmount: p.commission.aorAmount ?? undefined,
            status: p.commission.status,
          }
        : undefined,
    })),
  };
}

/** Client.sourceId no tiene relación de Prisma hacia LeadSource (queda como
 * referencia suelta a propósito, ver prisma/schema.prisma) — se resuelve el
 * nombre acá, en memoria, en vez de una consulta por cliente. */
async function sourceNameMap(): Promise<Map<string, string>> {
  const sources = await prisma.leadSource.findMany();
  return new Map(sources.map((s) => [s.id, s.name]));
}

/** Alcance de datos por rol, igual que getLeadsForUser: sin "*:view_all"
 * (Agent), un vendedor solo ve los clientes que tiene asignados. */
export async function getClientsForUser(user: SessionUser): Promise<ClientVM[]> {
  const [rows, sources] = await Promise.all([
    prisma.client.findMany({
      where: canViewAll(user) ? undefined : { agentId: user.agentId ?? "__sin-agente__" },
      include: clientInclude,
      orderBy: { createdAt: "desc" },
    }),
    sourceNameMap(),
  ]);
  return rows.map((r) => mapClient(r, r.sourceId ? sources.get(r.sourceId) : undefined));
}

/** Un cliente individual, con el mismo control de alcance — null tanto si no
 * existe como si el usuario no tiene permiso de verlo (nunca revela cuál de
 * los dos casos es). */
export async function getClientForUser(id: string, user: SessionUser): Promise<ClientVM | null> {
  const row = await prisma.client.findUnique({ where: { id }, include: clientInclude });
  if (!row) return null;
  if (!canViewAll(user) && row.agentId !== user.agentId) return null;
  const sourceName = row.sourceId
    ? (await prisma.leadSource.findUnique({ where: { id: row.sourceId } }))?.name
    : undefined;
  return mapClient(row, sourceName);
}

export interface ClientFormOptions {
  sources: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}

/** Catálogos vivos para el formulario "Nuevo cliente" — mismas tablas que ya
 * alimentan el formulario de Leads (LeadSource, Agent), sin las líneas de
 * negocio ni campos dinámicos por línea: esos se agregan cuando lleguen los
 * perfiles por línea (Medicare/Obamacare/Family Heritage) en un pase
 * posterior, no en esta base. */
export async function getClientFormOptions(): Promise<ClientFormOptions> {
  const [sources, agents] = await Promise.all([
    prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
    prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
  ]);
  return {
    sources: sources.map((s) => ({ id: s.id, name: s.name })),
    agents: agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
  };
}
