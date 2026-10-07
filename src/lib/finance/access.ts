import "server-only";

import { hasPermission, type SessionUser } from "@/lib/auth";
import { getUserVisibility } from "@/lib/visibility-server";

/**
 * Quién ve el Control Financiero:
 *  - Super Admin: siempre.
 *  - Resto: permiso "finance:view" (Admin y Manager por defecto) y que no
 *    tenga oculta la vista en Configuración → Visibilidad por usuario
 *    ("dashboard.finance").
 * Registrar / editar / eliminar exige además "finance:manage" (Admin).
 */
export async function canViewFinance(user: SessionUser): Promise<boolean> {
  if (!hasPermission(user, "finance", "view")) return false;
  const { hidden } = await getUserVisibility(user);
  return !hidden.has("dashboard.finance") && !hidden.has("module:/dashboard");
}

export async function canManageFinance(user: SessionUser): Promise<boolean> {
  return (await canViewFinance(user)) && hasPermission(user, "finance", "manage");
}
