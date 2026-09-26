"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { CommissionStatus } from "@/types";

export interface CommissionActionResult {
  ok: boolean;
  error?: string;
}

/** Cambia el estado de pago de una comisión (Pendiente/Pagada/Chargeback).
 * Al marcar Pagada por primera vez se registra la fecha de pago del
 * vendedor — no se pisa si ya existía (un cambio posterior de estado no
 * debe borrar cuándo se pagó realmente). */
export async function updateCommissionStatusAction(
  commissionId: string,
  status: CommissionStatus
): Promise<CommissionActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "commissions", "edit")) {
    return { ok: false, error: "No tienes permiso para editar comisiones." };
  }

  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: { policy: true },
  });
  if (!commission) return { ok: false, error: "La comisión ya no existe." };
  if (!canViewAll(user) && commission.policy.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar comisiones de otro vendedor." };
  }

  await prisma.commission.update({
    where: { id: commissionId },
    data: {
      status,
      agentPaymentDate: status === "PAID" && !commission.agentPaymentDate ? new Date() : commission.agentPaymentDate,
    },
  });
  await logAudit({
    userId: user.id,
    action: "COMMISSION_CHANGE",
    entityType: "Commission",
    entityId: commissionId,
    fieldName: "status",
    oldValue: commission.status,
    newValue: status,
  });

  revalidatePath("/commissions");
  revalidatePath(`/clients/${commission.policy.clientId}`);
  return { ok: true };
}
