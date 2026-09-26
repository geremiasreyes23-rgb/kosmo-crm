"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { assertRelatedOwnership } from "@/lib/relatedRecords";
import { logAudit } from "@/lib/audit";
import type { SaleMethod } from "@prisma/client";

export interface SaleActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateSaleInput {
  relatedLeadId?: string;
  relatedClientId?: string;
  insuranceLineId: string;
  carrierId: string;
  planName?: string;
  premium?: number;
  expectedCommission?: number;
  method?: SaleMethod;
  effectiveDate?: string;
  stageId: string;
  /** Ignorado si el usuario no tiene alcance "ver todo" — la venta siempre
   * se asigna a sí mismo en ese caso (mismo patrón que Leads/Pólizas). */
  agentId?: string;
}

export async function createSaleAction(input: CreateSaleInput): Promise<SaleActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "sales", "create")) {
    return { ok: false, error: "No tienes permiso para crear ventas." };
  }

  if (!input.insuranceLineId || !input.carrierId) {
    return { ok: false, error: "Línea de negocio y carrier son obligatorios." };
  }
  if (!input.stageId) {
    return { ok: false, error: "Selecciona una etapa inicial." };
  }

  const leadId = input.relatedLeadId || null;
  const clientId = input.relatedClientId || null;
  if (!leadId && !clientId) {
    return { ok: false, error: "Vincula la venta a un cliente o a un lead." };
  }
  const ownershipError = await assertRelatedOwnership(leadId, clientId, user);
  if (ownershipError) return { ok: false, error: ownershipError };

  const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
  if (!stage) return { ok: false, error: "La etapa seleccionada ya no existe." };

  const agentId = canViewAll(user) ? input.agentId || null : user.agentId;

  const sale = await prisma.sale.create({
    data: {
      leadId,
      clientId,
      agentId,
      insuranceLineId: input.insuranceLineId,
      carrierId: input.carrierId,
      planName: input.planName?.trim() || null,
      premium: input.premium != null && !Number.isNaN(input.premium) ? input.premium : null,
      expectedCommission:
        input.expectedCommission != null && !Number.isNaN(input.expectedCommission)
          ? input.expectedCommission
          : null,
      method: input.method || null,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      pipelineId: stage.pipelineId,
      stageId: stage.id,
    },
  });

  await prisma.pipelineHistory.create({
    data: { entityType: "SALE", entityId: sale.id, toStageId: stage.id, changedById: user.id },
  });
  await logAudit({ userId: user.id, action: "CREATE", entityType: "Sale", entityId: sale.id });

  revalidatePath("/sales");
  return { ok: true, id: sale.id };
}

/** Cambio de etapa — incluido el drag & drop del Kanban. Al llegar a una
 * etapa marcada isWon, crea automáticamente la Policy ligada a la venta
 * (sección 6.C del brief de arquitectura): "Al llegar a una etapa marcada
 * isWon, el sistema crea automáticamente un registro Policy ligado a esa
 * venta." La Policy nace en estado QUOTE, igual que una póliza creada a
 * mano desde el módulo de Pólizas — el flujo de Cotización → ... → Activa
 * (y la generación de Commission) sigue el mismo camino ya existente en
 * policies/actions.ts, sin duplicar esa lógica acá. */
export async function moveSaleStageAction(saleId: string, newStageId: string): Promise<SaleActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "sales", "edit")) {
    return { ok: false, error: "No tienes permiso para mover ventas de etapa." };
  }

  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) return { ok: false, error: "La venta ya no existe." };
  if (!canViewAll(user) && sale.agentId !== user.agentId) {
    return { ok: false, error: "No puedes editar ventas de otro vendedor." };
  }
  if (sale.stageId === newStageId) return { ok: true };

  const newStage = await prisma.pipelineStage.findUnique({ where: { id: newStageId } });
  if (!newStage) return { ok: false, error: "La etapa seleccionada ya no existe." };

  if (newStage.isWon && !sale.clientId) {
    return {
      ok: false,
      error: "Vincula esta venta a un cliente antes de marcarla como cerrada (se necesita para crear la póliza).",
    };
  }

  const existingPolicy = newStage.isWon
    ? await prisma.policy.findUnique({ where: { saleId } })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: saleId }, data: { stageId: newStageId } });
    await tx.pipelineHistory.create({
      data: {
        entityType: "SALE",
        entityId: saleId,
        fromStageId: sale.stageId,
        toStageId: newStageId,
        changedById: user.id,
      },
    });
    await logAudit(
      {
        userId: user.id,
        action: "STAGE_CHANGE",
        entityType: "Sale",
        entityId: saleId,
        fieldName: "stageId",
        oldValue: sale.stageId,
        newValue: newStageId,
      },
      tx
    );
    if (newStage.isWon && sale.clientId && !existingPolicy) {
      const createdPolicy = await tx.policy.create({
        data: {
          clientId: sale.clientId,
          insuranceLineId: sale.insuranceLineId!,
          carrierId: sale.carrierId!,
          planName: sale.planName,
          premium: sale.premium,
          saleDate: sale.saleDate,
          effectiveDate: sale.effectiveDate,
          status: "QUOTE",
          agentId: sale.agentId,
          saleId: sale.id,
        },
      });
      await logAudit(
        {
          userId: user.id,
          action: "POLICY_CHANGE",
          entityType: "Policy",
          entityId: createdPolicy.id,
          fieldName: "createdFromSaleId",
          newValue: sale.id,
        },
        tx
      );
    }
  });

  revalidatePath("/sales");
  revalidatePath("/policies");
  if (sale.clientId) revalidatePath(`/clients/${sale.clientId}`);
  return { ok: true };
}
