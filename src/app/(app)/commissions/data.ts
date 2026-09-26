import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewAll, type SessionUser } from "@/lib/auth";
import type { CommissionVM } from "@/types";

const commissionInclude = {
  policy: { include: { client: true, insuranceLine: true } },
} satisfies Prisma.CommissionInclude;

type CommissionRow = Prisma.CommissionGetPayload<{ include: typeof commissionInclude }>;

function mapCommission(row: CommissionRow): CommissionVM {
  return {
    id: row.id,
    policyId: row.policyId,
    policyNumber: row.policy.policyNumber ?? undefined,
    clientName: `${row.policy.client.firstName} ${row.policy.client.lastName}`,
    line: row.policy.insuranceLine.name,
    agentAmount: row.agentAmount ?? undefined,
    managerAmount: row.managerAmount ?? undefined,
    aorAmount: row.aorAmount ?? undefined,
    totalAcquisitionCost: row.totalAcquisitionCost ?? undefined,
    carrierCommission: row.carrierCommission ?? undefined,
    margin: row.margin ?? undefined,
    agentPaymentDate: row.agentPaymentDate ? row.agentPaymentDate.toISOString().slice(0, 10) : undefined,
    carrierPaymentDate: row.carrierPaymentDate ? row.carrierPaymentDate.toISOString().slice(0, 10) : undefined,
    status: row.status,
  };
}

/** Alcance de datos por rol, igual convención que Pólizas: sin
 * "*:view_all", un vendedor solo ve las comisiones de sus propias pólizas. */
export async function getCommissionsForUser(user: SessionUser): Promise<CommissionVM[]> {
  const rows = await prisma.commission.findMany({
    where: canViewAll(user) ? undefined : { policy: { agentId: user.agentId ?? "__sin-agente__" } },
    include: commissionInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapCommission);
}

export interface CommissionsSummary {
  pending: number;
  paid: number;
  chargebacks: number;
  margin: number;
}

export async function getCommissionsSummaryForUser(user: SessionUser): Promise<CommissionsSummary> {
  const where = canViewAll(user) ? undefined : { policy: { agentId: user.agentId ?? "__sin-agente__" } };
  const rows = await prisma.commission.findMany({ where, select: { agentAmount: true, margin: true, status: true } });
  return rows.reduce(
    (acc, r) => {
      if (r.status === "PENDING") acc.pending += r.agentAmount ?? 0;
      if (r.status === "PAID") acc.paid += r.agentAmount ?? 0;
      if (r.status === "CHARGEBACK") acc.chargebacks += 1;
      acc.margin += r.margin ?? 0;
      return acc;
    },
    { pending: 0, paid: 0, chargebacks: 0, margin: 0 }
  );
}
