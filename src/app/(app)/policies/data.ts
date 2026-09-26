import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { Policy as PolicyVM } from "@/types";

function fullName(a: { firstName: string; lastName: string } | null | undefined): string {
  return a ? `${a.firstName} ${a.lastName}` : "Sin asignar";
}

const policyInclude = {
  client: true,
  insuranceLine: true,
  carrier: true,
  agent: true,
} satisfies Prisma.PolicyInclude;

type PolicyRow = Prisma.PolicyGetPayload<{ include: typeof policyInclude }>;

function mapPolicy(row: PolicyRow): PolicyVM {
  return {
    id: row.id,
    policyNumber: row.policyNumber ?? undefined,
    clientId: row.clientId,
    clientName: `${row.client.firstName} ${row.client.lastName}`,
    insuranceLineId: row.insuranceLineId,
    line: row.insuranceLine.name,
    carrierId: row.carrierId,
    carrier: row.carrier.name,
    planName: row.planName ?? undefined,
    premium: row.premium ?? undefined,
    saleDate: row.saleDate ? row.saleDate.toISOString().slice(0, 10) : undefined,
    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : undefined,
    status: row.status,
    agentId: row.agentId ?? undefined,
    agentName: fullName(row.agent),
  };
}

/** Alcance de datos por rol (sección 7 del brief de arquitectura): sin el
 * permiso "*:view_all", un vendedor solo ve las pólizas donde figura como
 * agente asignado — igual convención que Leads/Clientes. */
export async function getPoliciesForUser(user: SessionUser): Promise<PolicyVM[]> {
  const rows = await prisma.policy.findMany({
    where: canViewAll(user) ? undefined : { agentId: user.agentId ?? "__sin-agente__" },
    include: policyInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapPolicy);
}

export interface PolicyFormOptions {
  clients: { id: string; name: string }[];
  insuranceLines: { id: string; name: string }[];
  carriers: { id: string; name: string; insuranceLineIds: string[] }[];
  agents: { id: string; name: string }[];
}

/** Catálogos vivos para el formulario "Nueva póliza". El listado de clientes
 * respeta el mismo alcance por rol que el resto del módulo: un vendedor sin
 * "ver todo" solo puede facturar pólizas a sus propios clientes. */
export async function getPolicyFormOptions(user: SessionUser): Promise<PolicyFormOptions> {
  const [clients, lines, carriers, agents] = await Promise.all([
    prisma.client.findMany({
      where: canViewAll(user) ? undefined : { agentId: user.agentId ?? "__sin-agente__" },
      orderBy: { firstName: "asc" },
    }),
    prisma.insuranceLine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.carrier.findMany({
      where: { status: "ACTIVE" },
      include: { lines: true },
      orderBy: { name: "asc" },
    }),
    prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
  ]);

  return {
    clients: clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
    insuranceLines: lines.map((l) => ({ id: l.id, name: l.name })),
    carriers: carriers.map((c) => ({
      id: c.id,
      name: c.name,
      insuranceLineIds: c.lines.map((l) => l.insuranceLineId),
    })),
    agents: agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
  };
}
