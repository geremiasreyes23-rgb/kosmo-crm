"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { NOTIFICATION_SETTING_TYPES } from "@/lib/notificationSettings";
import type { CarrierStatus } from "@prisma/client";

/**
 * Configuración → Líneas de negocio / Carriers / Orígenes de leads /
 * Notificaciones. Las cuatro pestañas eran texto fijo o listas
 * hardcodeadas en settings/page.tsx sin ninguna acción real detrás — los
 * modelos (InsuranceLine, Carrier, CarrierInsuranceLine, LeadSource,
 * NotificationSetting) ya existían o se agregaron para esto, pero nada
 * escribía en ellos desde la UI.
 */

const MANAGER_ROLES = ["Super Admin", "Admin"];

async function requireCatalogManager() {
  const current = await requireUser();
  if (!MANAGER_ROLES.includes(current.roleName)) {
    return { current: null, error: "No tienes permiso para editar esta configuración." };
  }
  return { current, error: null };
}

export interface CatalogActionResult {
  ok: boolean;
  error?: string;
}

// --- Líneas de negocio -----------------------------------------------------

export async function createInsuranceLineAction(input: {
  name: string;
  code: string;
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  if (!name || !code) return { ok: false, error: "Completa nombre y código." };

  const existing = await prisma.insuranceLine.findFirst({ where: { OR: [{ name }, { code }] } });
  if (existing) return { ok: false, error: "Ya existe una línea con ese nombre o código." };

  const line = await prisma.insuranceLine.create({ data: { name, code, isActive: true } });
  await logAudit({ userId: current.id, action: "CREATE", entityType: "InsuranceLine", entityId: line.id, fieldName: "name", newValue: name });

  revalidatePath("/settings");
  return { ok: true };
}

export async function setInsuranceLineActiveAction(input: {
  lineId: string;
  isActive: boolean;
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const line = await prisma.insuranceLine.findUnique({ where: { id: input.lineId } });
  if (!line) return { ok: false, error: "Línea no encontrada." };

  await prisma.insuranceLine.update({ where: { id: input.lineId }, data: { isActive: input.isActive } });
  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "InsuranceLine",
    entityId: input.lineId,
    fieldName: "isActive",
    oldValue: String(line.isActive),
    newValue: String(input.isActive),
  });

  revalidatePath("/settings");
  return { ok: true };
}

// --- Carriers ----------------------------------------------------------------

export async function createCarrierAction(input: {
  name: string;
  insuranceLineIds: string[];
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del carrier no puede estar vacío." };

  const existing = await prisma.carrier.findUnique({ where: { name } });
  if (existing) return { ok: false, error: "Ya existe un carrier con ese nombre." };

  const carrier = await prisma.carrier.create({
    data: {
      name,
      status: "ACTIVE",
      lines: { create: input.insuranceLineIds.map((insuranceLineId) => ({ insuranceLineId })) },
    },
  });
  await logAudit({ userId: current.id, action: "CREATE", entityType: "Carrier", entityId: carrier.id, fieldName: "name", newValue: name });

  revalidatePath("/settings");
  return { ok: true };
}

export async function setCarrierStatusAction(input: {
  carrierId: string;
  status: CarrierStatus;
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const carrier = await prisma.carrier.findUnique({ where: { id: input.carrierId } });
  if (!carrier) return { ok: false, error: "Carrier no encontrado." };

  await prisma.carrier.update({ where: { id: input.carrierId }, data: { status: input.status } });
  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "Carrier",
    entityId: input.carrierId,
    fieldName: "status",
    oldValue: carrier.status,
    newValue: input.status,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function setCarrierLinesAction(input: {
  carrierId: string;
  insuranceLineIds: string[];
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const carrier = await prisma.carrier.findUnique({ where: { id: input.carrierId } });
  if (!carrier) return { ok: false, error: "Carrier no encontrado." };

  // Reemplazo completo (borra las asociaciones viejas y crea las nuevas) en
  // una transacción — más simple y sin riesgo de duplicados que calcular el
  // diff entre el set viejo y el nuevo.
  await prisma.$transaction([
    prisma.carrierInsuranceLine.deleteMany({ where: { carrierId: input.carrierId } }),
    prisma.carrierInsuranceLine.createMany({
      data: input.insuranceLineIds.map((insuranceLineId) => ({ carrierId: input.carrierId, insuranceLineId })),
    }),
  ]);

  revalidatePath("/settings");
  return { ok: true };
}

// --- Orígenes de leads ---------------------------------------------------------

export async function createLeadSourceAction(input: { name: string }): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre no puede estar vacío." };

  const existing = await prisma.leadSource.findUnique({ where: { name } });
  if (existing) return { ok: false, error: "Ya existe un origen con ese nombre." };

  const source = await prisma.leadSource.create({ data: { name } });
  await logAudit({ userId: current.id, action: "CREATE", entityType: "LeadSource", entityId: source.id, fieldName: "name", newValue: name });

  revalidatePath("/settings");
  return { ok: true };
}

export async function renameLeadSourceAction(input: {
  sourceId: string;
  name: string;
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre no puede estar vacío." };

  const source = await prisma.leadSource.findUnique({ where: { id: input.sourceId } });
  if (!source) return { ok: false, error: "Origen no encontrado." };

  const clash = await prisma.leadSource.findUnique({ where: { name } });
  if (clash && clash.id !== input.sourceId) return { ok: false, error: "Ya existe un origen con ese nombre." };

  await prisma.leadSource.update({ where: { id: input.sourceId }, data: { name } });
  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "LeadSource",
    entityId: input.sourceId,
    fieldName: "name",
    oldValue: source.name,
    newValue: name,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteLeadSourceAction(input: { sourceId: string }): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const leadCount = await prisma.lead.count({ where: { sourceId: input.sourceId } });
  if (leadCount > 0) {
    return { ok: false, error: `No se puede eliminar: ${leadCount} lead(s) usan este origen.` };
  }

  const source = await prisma.leadSource.findUnique({ where: { id: input.sourceId } });
  if (!source) return { ok: false, error: "Origen no encontrado." };

  await prisma.leadSource.delete({ where: { id: input.sourceId } });
  await logAudit({ userId: current.id, action: "DELETE", entityType: "LeadSource", entityId: input.sourceId, fieldName: "name", oldValue: source.name });

  revalidatePath("/settings");
  return { ok: true };
}

// --- Notificaciones ------------------------------------------------------------

export async function setNotificationSettingAction(input: {
  type: string;
  enabled: boolean;
  thresholdValue: number | null;
}): Promise<CatalogActionResult> {
  const { current, error } = await requireCatalogManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  if (!NOTIFICATION_SETTING_TYPES.includes(input.type)) {
    return { ok: false, error: "Tipo de notificación no válido." };
  }
  if (input.thresholdValue !== null && (!Number.isFinite(input.thresholdValue) || input.thresholdValue < 1)) {
    return { ok: false, error: "El umbral debe ser un número mayor a 0." };
  }

  await prisma.notificationSetting.upsert({
    where: { type: input.type },
    update: { enabled: input.enabled, thresholdValue: input.thresholdValue },
    create: { type: input.type, enabled: input.enabled, thresholdValue: input.thresholdValue },
  });

  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "NotificationSetting",
    entityId: input.type,
    fieldName: "enabled",
    newValue: String(input.enabled),
  });

  revalidatePath("/settings");
  return { ok: true };
}
