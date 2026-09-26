import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { Sale as SaleVM, PipelineStage as StageVM } from "@/types";

/** Etapas del pipeline real de Ventas (sembrado por prisma/seed.ts) — mismo
 * patrón que getLeadPipelineStages, pero para el pipeline con
 * entityType "SALE" (sección 8 del brief de arquitectura). */
export async function getSalesPipelineStages(): Promise<StageVM[]> {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "SALE", isDefault: true },
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

const saleInclude = {
  client: { select: { firstName: true, lastName: true } },
  lead: { select: { firstName: true, lastName: true } },
  agent: true,
  insuranceLine: true,
  carrier: true,
  policy: { select: { id: true } },
} satisfies Prisma.SaleInclude;

type SaleRow = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

function mapSale(row: SaleRow): SaleVM {
  const clientName = row.client
    ? `${row.client.firstName} ${row.client.lastName}`
    : row.lead
      ? `${row.lead.firstName} ${row.lead.lastName}`
      : "Sin vincular";
  return {
    id: row.id,
    clientId: row.clientId ?? undefined,
    leadId: row.leadId ?? undefined,
    clientName,
    agentId: row.agentId ?? undefined,
    agentName: fullName(row.agent),
    insuranceLineId: row.insuranceLineId ?? undefined,
    line: row.insuranceLine?.name ?? "Sin línea",
    carrierId: row.carrierId ?? undefined,
    carrier: row.carrier?.name ?? "Sin carrier",
    planName: row.planName ?? undefined,
    premium: row.premium ?? 0,
    method: row.method ?? undefined,
    stageId: row.stageId,
    saleDate: row.saleDate.toISOString().slice(0, 10),
    effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : undefined,
    expectedCommission: row.expectedCommission ?? undefined,
    receivedCommission: row.receivedCommission ?? undefined,
    policyId: row.policy?.id ?? undefined,
  };
}

/** Alcance de datos por rol — sin "*:view_all", un vendedor solo ve las
 * ventas donde figura como agente (misma convención que Leads/Clientes/
 * Pólizas). */
export async function getSalesForUser(
  user: SessionUser,
  filter?: { clientId?: string; leadId?: string }
): Promise<SaleVM[]> {
  const rbacWhere: Prisma.SaleWhereInput | undefined = canViewAll(user)
    ? undefined
    : { agentId: user.agentId ?? "__sin-agente__" };

  const where: Prisma.SaleWhereInput = {
    ...(rbacWhere ?? {}),
    ...(filter?.clientId ? { clientId: filter.clientId } : {}),
    ...(filter?.leadId ? { leadId: filter.leadId } : {}),
  };

  const rows = await prisma.sale.findMany({
    where,
    include: saleInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapSale);
}

export interface SaleFormOptions {
  insuranceLines: { id: string; name: string }[];
  carriers: { id: string; name: string; insuranceLineIds: string[] }[];
  agents: { id: string; name: string }[];
}

/** Catálogos vivos para el formulario "Nueva venta" — el cliente/lead se
 * elige con getRelatedEntityOptions (src/lib/relatedRecords.ts), igual que
 * Actividades/Tareas/Citas. */
export async function getSaleFormOptions(): Promise<SaleFormOptions> {
  const [lines, carriers, agents] = await Promise.all([
    prisma.insuranceLine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.carrier.findMany({
      where: { status: "ACTIVE" },
      include: { lines: true },
      orderBy: { name: "asc" },
    }),
    prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
  ]);

  return {
    insuranceLines: lines.map((l) => ({ id: l.id, name: l.name })),
    carriers: carriers.map((c) => ({
      id: c.id,
      name: c.name,
      insuranceLineIds: c.lines.map((l) => l.insuranceLineId),
    })),
    agents: agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
  };
}
