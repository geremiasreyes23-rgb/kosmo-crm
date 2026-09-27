"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { NAV_MODULE_KEYS } from "@/lib/navModules";

/**
 * Configuración → Roles y permisos. Antes esta pestaña solo LISTABA los
 * roles (nombre + descripción), sin ninguna forma de tocar qué puede hacer
 * cada uno — el modelo RolePermission ya existía desde la Fase 2 (ver
 * arquitectura-fase1.md sección 7), pero nada en la UI lo escribía. Este
 * archivo es lo que faltaba: togglear permisos y visibilidad de módulos
 * por rol, de verdad, desde Configuración.
 */

const MANAGER_ROLES = ["Super Admin", "Admin"];

async function requireRolesManager() {
  const current = await requireUser();
  if (!MANAGER_ROLES.includes(current.roleName)) {
    return { current: null, error: "No tienes permiso para editar roles y permisos." };
  }
  return { current, error: null };
}

/**
 * Un Super Admin nunca depende de la tabla RolePermission (ver
 * hasPermission() en src/lib/auth.ts: el rol "Super Admin" pasa cualquier
 * chequeo sin consultar la base). Editar su fila sería mentirle a quien
 * configura esto — los checkboxes cambiarían sin que el acceso real
 * cambie nunca — así que se bloquea directamente acá, no solo se
 * deshabilita en la UI.
 */
function assertEditableRole(roleName: string, currentRoleName: string): string | null {
  if (roleName === "Super Admin") {
    return "Super Admin tiene acceso total fijo por diseño. No depende de permisos guardados, así que no se puede editar.";
  }
  if (roleName === "Admin" && currentRoleName !== "Super Admin") {
    return "Solo un Super Admin puede modificar los permisos del rol Admin.";
  }
  return null;
}

export interface RoleActionResult {
  ok: boolean;
  error?: string;
}

export async function setRolePermissionAction(input: {
  roleId: string;
  permissionId: string;
  granted: boolean;
}): Promise<RoleActionResult> {
  const { current, error } = await requireRolesManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { ok: false, error: "Rol no encontrado." };
  const blockReason = assertEditableRole(role.name, current.roleName);
  if (blockReason) return { ok: false, error: blockReason };

  const permission = await prisma.permission.findUnique({ where: { id: input.permissionId } });
  if (!permission) return { ok: false, error: "Permiso no válido." };

  if (input.granted) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: input.roleId, permissionId: input.permissionId } },
      update: {},
      create: { roleId: input.roleId, permissionId: input.permissionId },
    });
  } else {
    await prisma.rolePermission.deleteMany({
      where: { roleId: input.roleId, permissionId: input.permissionId },
    });
  }

  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "RolePermission",
    entityId: input.roleId,
    fieldName: `${permission.resource}:${permission.action}`,
    oldValue: String(!input.granted),
    newValue: String(input.granted),
  });

  // Los permisos de un usuario se leen de nuevo en cada request
  // (getSessionUser() en src/lib/auth.ts) — no hay nada cacheado en la
  // sesión en sí, así que este cambio aplica en la próxima acción o
  // navegación de cualquier usuario con ese rol, sin necesidad de que
  // vuelva a iniciar sesión.
  revalidatePath("/settings");
  return { ok: true };
}

export async function setRoleModuleVisibilityAction(input: {
  roleId: string;
  moduleKey: string;
  visible: boolean;
}): Promise<RoleActionResult> {
  const { current, error } = await requireRolesManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  if (!NAV_MODULE_KEYS.includes(input.moduleKey)) {
    return { ok: false, error: "Módulo no válido." };
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { ok: false, error: "Rol no encontrado." };
  const blockReason = assertEditableRole(role.name, current.roleName);
  if (blockReason) return { ok: false, error: blockReason };

  await prisma.roleModuleVisibility.upsert({
    where: { roleId_moduleKey: { roleId: input.roleId, moduleKey: input.moduleKey } },
    update: { visible: input.visible },
    create: { roleId: input.roleId, moduleKey: input.moduleKey, visible: input.visible },
  });

  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "RoleModuleVisibility",
    entityId: input.roleId,
    fieldName: input.moduleKey,
    oldValue: String(!input.visible),
    newValue: String(input.visible),
  });

  // El Sidebar lee la visibilidad por rol en el layout del grupo (app)
  // (src/app/(app)/layout.tsx, force-dynamic) en cada navegación — este
  // revalidatePath alcanza para que la próxima carga de cualquier página
  // ya refleje el cambio.
  revalidatePath("/", "layout");
  return { ok: true };
}
