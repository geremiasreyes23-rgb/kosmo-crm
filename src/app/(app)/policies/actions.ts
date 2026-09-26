"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { generateOrUpdateCommissionForPolicy } from "@/lib/commissions";
import { logAudit } from "@/lib/audit";
import type { PolicyStatus } from "@/types";

export interface PolicyActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreatePolicyInput {
  clientId: string;
  insuranceLineId: string;
  carrierId: string;
  planName?: string;
  premium?: number;
  policyNumber?: string;
  effectiveDate?: string;
  /** Ignorado si el usuario no tiene permiso de ver/asignar todo el negocio
   * — en ese caso la póliza siempre se asigna a sí mismo, igual que Leads. */
  agentId?: string;
}

export async function createPolicyAction(input: CreatePolicyInput): Promise<PolicyActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "policies", "create")) {
    return { ok: false, error: "No tienes permiso para crear pólizas." };
  }

  if (!input.clientId || !input.insuranceLineId || !input.carrierId) {
    return { ok: false, error: "Cliente, línea de negocio y carrier son obligatorios." };
  }

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) return { ok: false, error: "El cliente seleccionado ya no existe." };
  if (!canViewAll(user) && client.agentId !== user.agentId) {
    return { ok: false, error: "No puedes crear pólizas para clientes de otro vendedor." };
  }

  // Un vendedor sin alcance "ver todo" solo puede asignarse pólizas a sí
  // mismo — se ignora silenciosamente cualquier otro agentId que llegue del
  // formulario (nunca confiar en que la UI ocultó el selector).
  const agentId = canViewAll(user) ? input.agentId || client.agentId || null : user.agentId;

  const policy = await prisma.policy.create({
    data: {
      clientId: input.clientId,
      insuranceLineId: input.insuranceLineId,
      carrierId: input.carrierId,
      planName: input.planName?.trim() || null,
      premium: input.premium != null && !Number.isNaN(input.premium) ? input.premium : null,
      policyNumber: input.policyNumber?.trim() || null,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      saleDate: new Date(),
      status: "QUOTE",
      agentId,
    },
  });

  await logAudit({ userId: user.id, action: "CREATE", entityType: "Policy", entityId: policy.id });

  revalidatePath("/policies");
  revalidatePath(`/clients/${input.clientId}`);
  return { ok: true, id: policy.id };
}

/** Cambio de estado de una póliza (Cotización → ... → Activa/Cancelada, etc.).
 * Respeta el mismo alcance por rol que el resto del módulo. */
export async function updatePolicyStatusAction(
  policyId: string,
  status: PolicyStatus
): Promise<PolicyActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "policies", "edit")) {
    return { ok: false, error: "No tienes permiso para editar pólizas." };
  }

  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) return { ok: false, error: "La póliza ya no existe." };
  if (!canViewAll(user) && policy.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar pólizas de otro vendedor." };
  }

  // Al pasar a Activa se genera (o actualiza) la comisión automáticamente
  // con la tarifa vigente — sección 11 del brief de arquitectura, ver
  // src/lib/commissions.ts. Todo en una sola transacción para que el
  // cambio de estado y el cálculo de comisión queden atómicos.
  await prisma.$transaction(async (tx) => {
    await tx.policy.update({
      where: { id: policyId },
      data: {
        status,
        effectiveDate: status === "ACTIVE" && !policy.effectiveDate ? new Date() : policy.effectiveDate,
      },
    });
    await logAudit(
      {
        userId: user.id,
        action: "POLICY_CHANGE",
        entityType: "Policy",
        entityId: policyId,
        fieldName: "status",
        oldValue: policy.status,
        newValue: status,
      },
      tx
    );
    if (status === "ACTIVE") {
      await generateOrUpdateCommissionForPolicy(tx, policyId);
    }
  });

  revalidatePath("/policies");
  revalidatePath("/commissions");
  revalidatePath(`/clients/${policy.clientId}`);
  return { ok: true };
}
