import "server-only";

import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import { calculateAge } from "@/lib/utils";
import type { DashboardSummary } from "@/types";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fullName(a: { firstName: string; lastName: string } | null | undefined): string {
  return a ? `${a.firstName} ${a.lastName}` : "Sin asignar";
}

function monthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/**
 * Resumen del dashboard (Fase 11) — reemplaza dashboardSummary de
 * src/data/mock.ts con conteos reales. Definiciones adoptadas donde el
 * nombre del campo era ambiguo (documentado acá porque no hay una
 * especificación más precisa en el brief de arquitectura):
 *  - newLeads / newClients / salesThisMonth: creados dentro del mes
 *    calendario actual.
 *  - pendingLeads: leads en la etapa "Contactar" del pipeline (todavía sin
 *    primer contacto).
 *  - contactedLeads: leads con al menos un contacto registrado
 *    (lastContactAt no nulo).
 *  - convertedLeads: leads con Lead.convertedClientId no nulo (histórico,
 *    no solo del mes).
 * Todo respeta el mismo alcance por rol que el resto del sistema.
 */
export async function getDashboardSummary(user: SessionUser): Promise<DashboardSummary> {
  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const { start, end } = monthRange();

  const [
    newLeads,
    pendingLeads,
    contactedLeads,
    convertedLeads,
    newClients,
    salesThisMonth,
    activePolicies,
    pendingPolicies,
    cancelledPolicies,
    commissionAgg,
  ] = await Promise.all([
    prisma.lead.count({ where: { agentId: scopeAgent, createdAt: { gte: start, lt: end } } }),
    prisma.lead.count({ where: { agentId: scopeAgent, stage: { name: "Contactar" } } }),
    prisma.lead.count({ where: { agentId: scopeAgent, lastContactAt: { not: null } } }),
    prisma.lead.count({ where: { agentId: scopeAgent, convertedClientId: { not: null } } }),
    prisma.client.count({ where: { agentId: scopeAgent, createdAt: { gte: start, lt: end } } }),
    prisma.policy.count({ where: { agentId: scopeAgent, saleDate: { gte: start, lt: end } } }),
    prisma.policy.count({ where: { agentId: scopeAgent, status: "ACTIVE" } }),
    prisma.policy.count({ where: { agentId: scopeAgent, status: "PENDING" } }),
    prisma.policy.count({ where: { agentId: scopeAgent, status: "CANCELLED" } }),
    prisma.commission.findMany({
      where: { policy: { agentId: scopeAgent } },
      select: { agentAmount: true, margin: true, status: true },
    }),
  ]);

  const commissionsPending = commissionAgg
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + (c.agentAmount ?? 0), 0);
  const commissionsPaid = commissionAgg
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + (c.agentAmount ?? 0), 0);
  const chargebacks = commissionAgg.filter((c) => c.status === "CHARGEBACK").length;
  const margin = commissionAgg.reduce((sum, c) => sum + (c.margin ?? 0), 0);

  return {
    newLeads,
    pendingLeads,
    contactedLeads,
    convertedLeads,
    newClients,
    salesThisMonth,
    activePolicies,
    pendingPolicies,
    cancelledPolicies,
    commissionsPending,
    commissionsPaid,
    chargebacks,
    margin,
  };
}

export async function getSalesByLineChart(user: SessionUser): Promise<{ line: string; ventas: number }[]> {
  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const policies = await prisma.policy.findMany({ where: { agentId: scopeAgent }, include: { insuranceLine: true } });
  const byLine = new Map<string, number>();
  for (const p of policies) byLine.set(p.insuranceLine.name, (byLine.get(p.insuranceLine.name) ?? 0) + 1);
  return Array.from(byLine.entries()).map(([line, ventas]) => ({ line, ventas }));
}

export async function getSalesTrendChart(user: SessionUser): Promise<{ mes: string; ventas: number }[]> {
  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_LABELS[d.getMonth()] });
  }
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const policies = await prisma.policy.findMany({
    where: { agentId: scopeAgent, saleDate: { gte: rangeStart } },
    select: { saleDate: true },
  });
  const counts = new Map<string, number>();
  for (const p of policies) {
    if (!p.saleDate) continue;
    const key = `${p.saleDate.getFullYear()}-${String(p.saleDate.getMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return months.map((m) => ({ mes: m.label, ventas: counts.get(m.key) ?? 0 }));
}

export async function getAgentPerformance(user: SessionUser): Promise<{ agente: string; ventas: number }[]> {
  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const policies = await prisma.policy.findMany({ where: { agentId: scopeAgent }, include: { agent: true } });
  const byAgent = new Map<string, number>();
  for (const p of policies) {
    const name = fullName(p.agent);
    byAgent.set(name, (byAgent.get(name) ?? 0) + 1);
  }
  return Array.from(byAgent.entries())
    .map(([agente, ventas]) => ({ agente, ventas }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 6);
}

export async function getTurning65Alerts(
  user: SessionUser
): Promise<{ clientName: string; turns65On: string }[]> {
  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const clients = await prisma.client.findMany({ where: { agentId: scopeAgent, dob: { not: null } } });
  const rows = clients
    .map((c) => {
      const dobIso = c.dob!.toISOString().slice(0, 10);
      const age = calculateAge(dobIso);
      const turns65 = new Date(c.dob!);
      turns65.setFullYear(c.dob!.getFullYear() + 65);
      return { clientName: `${c.firstName} ${c.lastName}`, age, turns65On: turns65.toISOString().slice(0, 10) };
    })
    .filter((r) => r.age === 64 || r.age === 65)
    .sort((a, b) => a.turns65On.localeCompare(b.turns65On))
    .slice(0, 6);
  return rows.map((r) => ({ clientName: r.clientName, turns65On: r.turns65On }));
}
