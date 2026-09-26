"use server";

import { revalidatePath } from "next/cache";
import type { AmountType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";

export interface CommissionRateActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateCommissionRateInput {
  insuranceLineId: string;
  /** Vacío = tarifa base de la línea (aplica a todo agente sin tarifa
   * propia) — misma convención que documenta el schema. */
  agentId?: string;
  agentAmountOrPct: number;
  agentAmountType: AmountType;
  managerPct?: number;
  aorAmount?: number;
}

/** Tabla de tarifas (Configuración → Tabla de tarifas, sección 11 del brief
 * de arquitectura) — nunca hardcodeada en código: `Commission` (Fase 10, ver
 * commissions/actions.ts) siempre resuelve la tarifa vigente consultando
 * esta tabla en el momento de la venta. */
export async function createCommissionRateAction(
  input: CreateCommissionRateInput
): Promise<CommissionRateActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "commissions", "admin")) {
    return { ok: false, error: "No tienes permiso para administrar tarifas de comisión." };
  }

  if (!input.insuranceLineId) {
    return { ok: false, error: "Selecciona una línea de negocio." };
  }
  if (!input.agentAmountOrPct || input.agentAmountOrPct <= 0) {
    return { ok: false, error: "El monto o porcentaje del vendedor debe ser mayor a cero." };
  }

  // Al crear una tarifa nueva para la misma línea (y mismo agente, o ambas
  // "base"), se cierra la anterior vigente en vez de dejar dos tarifas
  // activas al mismo tiempo — así "tarifa vigente en saleDate" siempre
  // resuelve a una sola fila sin ambigüedad.
  await prisma.commissionRate.updateMany({
    where: {
      insuranceLineId: input.insuranceLineId,
      agentId: input.agentId || null,
      effectiveTo: null,
    },
    data: { effectiveTo: new Date() },
  });

  await prisma.commissionRate.create({
    data: {
      insuranceLineId: input.insuranceLineId,
      agentId: input.agentId || null,
      agentAmountOrPct: input.agentAmountOrPct,
      agentAmountType: input.agentAmountType,
      managerPct: input.managerPct ?? null,
      aorAmount: input.aorAmount ?? null,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}

/** Cierra la vigencia de una tarifa (no se borra — queda el historial para
 * que las comisiones ya calculadas con ella sigan siendo trazables). */
export async function deactivateCommissionRateAction(rateId: string): Promise<CommissionRateActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "commissions", "admin")) {
    return { ok: false, error: "No tienes permiso para administrar tarifas de comisión." };
  }

  const rate = await prisma.commissionRate.findUnique({ where: { id: rateId } });
  if (!rate) return { ok: false, error: "La tarifa ya no existe." };

  await prisma.commissionRate.update({
    where: { id: rateId },
    data: { effectiveTo: new Date() },
  });

  revalidatePath("/settings");
  return { ok: true };
}
