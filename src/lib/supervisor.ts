import "server-only";

import { prisma } from "@/lib/db";

/** Roles que pueden asignar o cambiar el supervisor de un usuario. */
export const SUPERVISOR_MANAGER_ROLES = ["Super Admin", "Admin"];

export function canManageSupervisors(roleName: string): boolean {
  return SUPERVISOR_MANAGER_ROLES.includes(roleName);
}

/**
 * Valida que `supervisorId` pueda ser supervisor de `userId`: existe, está
 * activo, no es la misma persona y no está (directa o indirectamente) bajo
 * la supervisión de `userId` — así nunca se forman cadenas circulares.
 * Devuelve el mensaje de error, o null si es válido.
 */
export async function validateSupervisor(userId: string, supervisorId: string): Promise<string | null> {
  if (supervisorId === userId) return "Un usuario no puede ser su propio supervisor.";
  let cursor: string | null = supervisorId;
  for (let i = 0; cursor && i < 20; i++) {
    const row: { status: string; supervisorId: string | null } | null = await prisma.user.findUnique({
      where: { id: cursor },
      select: { status: true, supervisorId: true },
    });
    if (!row) return "El supervisor seleccionado ya no existe.";
    if (i === 0 && row.status !== "ACTIVE") return "El supervisor seleccionado no está activo.";
    if (row.supervisorId === userId) return "Esa persona está bajo la supervisión de este usuario; no puede ser su supervisor.";
    cursor = row.supervisorId;
  }
  return null;
}
