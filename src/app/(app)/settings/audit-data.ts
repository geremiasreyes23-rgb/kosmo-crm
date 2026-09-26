import "server-only";

import { prisma } from "@/lib/db";

export interface AuditLogRowVM {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

// Tope simple para no traer la tabla entera a memoria — es un visor, no un
// exportador. Si en el futuro el volumen lo justifica, esto pasa a
// paginación real (cursor sobre createdAt); por ahora, con un CRM de una
// sola agencia, los últimos 300 eventos cubren de sobra varios días de uso.
const MAX_ROWS = 300;

/** Registro de auditoría para el visor de Configuración → Auditoría —
 * acceso reservado a quien tenga el permiso "audit:view" (Super Admin/Admin
 * por defecto, ver EXTRA_PERMISSIONS en prisma/seed.ts). A propósito no se
 * filtra por agentId/alcance de vendedor: la auditoría es transversal a
 * todo el sistema, no un dato "propio" de un vendedor. */
export async function getAuditLogEntries(): Promise<AuditLogRowVM[]> {
  const rows = await prisma.auditLog.findMany({
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  return rows.map((r) => ({
    id: r.id,
    userName: `${r.user.firstName} ${r.user.lastName}`,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    fieldName: r.fieldName ?? undefined,
    oldValue: r.oldValue ?? undefined,
    newValue: r.newValue ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}
