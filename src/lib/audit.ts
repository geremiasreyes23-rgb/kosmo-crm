import "server-only";

import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Fase 13 (Auditoría + Seguridad) — punto único para escribir en AuditLog.
 * Antes de esto, cada acción que quería dejar rastro escribía su propio
 * `prisma.auditLog.create({...})` inline (ver profile/actions.ts,
 * profile/recognition-actions.ts) — funciona, pero no escala a las
 * mutaciones más sensibles del CRM (usuarios, ventas, pólizas, comisiones)
 * sin repetir el mismo bloque una y otra vez. Este helper centraliza eso.
 *
 * Nunca debe tirar abajo la mutación que audita: un fallo acá se loguea y
 * se traga, igual que el criterio ya usado en notificationScheduler.ts —
 * perder un registro de auditoría es malo, pero bloquear la operación real
 * del usuario por un problema de logging sería peor.
 */
export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Registra un evento de auditoría. Acepta un cliente de transacción
 * opcional (`tx`) para que el registro quede atómico junto con el cambio
 * que documenta, cuando la acción que lo dispara ya usa
 * `prisma.$transaction` (ver moveSaleStageAction en sales/actions.ts para
 * un ejemplo de ese patrón con PipelineHistory).
 */
export async function logAudit(input: AuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
  try {
    const client = tx ?? prisma;
    await client.auditLog.create({ data: input });
  } catch (err) {
    console.error("[audit] no se pudo registrar el evento:", err);
  }
}
