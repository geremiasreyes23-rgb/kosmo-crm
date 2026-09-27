"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { publishNotificationEvent } from "@/lib/notificationEvents";
import type { CommissionStatus } from "@/types";

export interface CommissionActionResult {
  ok: boolean;
  error?: string;
}

/** Cambia el estado de pago de una comisión (Pendiente/Pagada/Chargeback).
 * Al marcar Pagada por primera vez se registra la fecha de pago del
 * vendedor — no se pisa si ya existía (un cambio posterior de estado no
 * debe borrar cuándo se pagó realmente). */
const VALID_COMMISSION_STATUSES: CommissionStatus[] = ["PENDING", "PAID", "CHARGEBACK"];

export async function updateCommissionStatusAction(
  commissionId: string,
  status: CommissionStatus
): Promise<CommissionActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "commissions", "edit")) {
    return { ok: false, error: "No tienes permiso para editar comisiones." };
  }
  if (!VALID_COMMISSION_STATUSES.includes(status)) {
    return { ok: false, error: "Estado de comisión inválido." };
  }

  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      policy: {
        include: {
          client: { select: { firstName: true, lastName: true } },
          agent: { include: { user: { include: { supervisor: true } } } },
        },
      },
    },
  });
  if (!commission) return { ok: false, error: "La comisión ya no existe." };
  if (!canViewAll(user) && commission.policy.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar comisiones de otro vendedor." };
  }
  const wasChargeback = commission.status === "CHARGEBACK";

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

  // Configuración → Notificaciones → "Chargeback de comisión" — antes esa
  // fila del panel describía algo que nunca pasaba: ningún cambio de
  // estado generaba una Notification real. Se dispara acá (evento puntual,
  // como mail/messenger — no algo que notificationScheduler.ts tenga que
  // "descubrir" re-escaneando la base) y respeta el toggle on/off del
  // panel, no solo el mensajero de comisiones edit.
  if (status === "CHARGEBACK" && !wasChargeback) {
    const setting = await prisma.notificationSetting.findUnique({ where: { type: "chargeback" } });
    if (setting?.enabled ?? true) {
      const clientName = `${commission.policy.client.firstName} ${commission.policy.client.lastName}`;
      const recipientUserIds = new Set<string>();
      if (commission.policy.agent?.user) recipientUserIds.add(commission.policy.agent.user.id);
      if (commission.policy.agent?.user?.supervisor) recipientUserIds.add(commission.policy.agent.user.supervisor.id);
      for (const userId of recipientUserIds) {
        const row = await prisma.notification.create({
          data: {
            userId,
            type: "chargeback",
            title: "Chargeback de comisión",
            message: `La comisión de ${clientName} pasó a Chargeback`,
            relatedEntityType: "Commission",
            relatedEntityId: commissionId,
          },
        });
        publishNotificationEvent({
          type: "notification",
          userId,
          notification: {
            id: row.id,
            type: row.type,
            title: row.title,
            message: row.message,
            relatedEntityType: row.relatedEntityType ?? undefined,
            relatedEntityId: row.relatedEntityId ?? undefined,
            isRead: row.isRead,
            createdAt: row.createdAt.toISOString(),
          },
        });
      }
    }
  }

  revalidatePath("/commissions");
  revalidatePath(`/clients/${commission.policy.clientId}`);
  return { ok: true };
}
