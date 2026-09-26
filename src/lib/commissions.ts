import "server-only";

import type { Prisma } from "@prisma/client";

/** Busca la CommissionRate vigente para una línea de negocio en una fecha
 * dada — la tarifa propia del agente (si existe) tiene prioridad sobre la
 * tarifa base de la línea (agentId null), igual que documenta el schema. */
async function findEffectiveRate(
  tx: Prisma.TransactionClient,
  insuranceLineId: string,
  agentId: string | null,
  atDate: Date
) {
  const whereBase = {
    insuranceLineId,
    effectiveFrom: { lte: atDate },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: atDate } }],
  };
  if (agentId) {
    const agentRate = await tx.commissionRate.findFirst({
      where: { ...whereBase, agentId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (agentRate) return agentRate;
  }
  return tx.commissionRate.findFirst({
    where: { ...whereBase, agentId: null },
    orderBy: { effectiveFrom: "desc" },
  });
}

/**
 * Genera o actualiza la Commission de una póliza usando la tarifa vigente
 * al momento de la venta — sección 11 del brief de arquitectura: "se genera
 * automáticamente cuando la póliza pasa a un estado facturable, usando la
 * tarifa vigente en saleDate". Se llama desde updatePolicyStatusAction
 * (policies/actions.ts) cuando una póliza pasa a ACTIVE.
 *
 * No hace nada si no hay ninguna tarifa configurada para esa línea (nunca
 * inventa un monto), y no sobreescribe una Commission que ya tiene un pago
 * registrado (agentPaymentDate/carrierPaymentDate) — evita recalcular algo
 * que ya se pagó solo porque cambió la tarifa después.
 */
export async function generateOrUpdateCommissionForPolicy(
  tx: Prisma.TransactionClient,
  policyId: string
): Promise<void> {
  const policy = await tx.policy.findUnique({ where: { id: policyId } });
  if (!policy) return;

  const existing = await tx.commission.findUnique({ where: { policyId } });
  if (existing && (existing.agentPaymentDate || existing.carrierPaymentDate)) return;

  const rate = await findEffectiveRate(tx, policy.insuranceLineId, policy.agentId, policy.saleDate ?? new Date());
  if (!rate) return;

  const premium = policy.premium ?? 0;
  const agentAmount =
    rate.agentAmountType === "PERCENTAGE" ? (premium * rate.agentAmountOrPct) / 100 : rate.agentAmountOrPct;
  const managerAmount = rate.managerPct != null ? (premium * rate.managerPct) / 100 : null;
  const aorAmount = rate.aorAmount ?? null;

  await tx.commission.upsert({
    where: { policyId },
    update: { agentAmount, managerAmount, aorAmount },
    create: { policyId, agentAmount, managerAmount, aorAmount, status: "PENDING" },
  });
}
