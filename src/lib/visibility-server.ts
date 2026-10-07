import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { NAV_MODULE_KEYS } from "@/lib/navModules";
import { computeHiddenKeys, keysForPath, moduleKey } from "@/lib/visibility";

export interface UserVisibility {
  /** Claves ocultas para esta persona (ya incluye lo que cuelga de algo oculto). */
  hidden: Set<string>;
  /** Módulos del menú que ve (href), para el Sidebar. */
  visibleModuleKeys: Set<string>;
}

/**
 * Visibilidad efectiva del usuario en sesión: rol + excepciones personales
 * (Configuración → Visibilidad por usuario). Se calcula una sola vez por
 * petición (React cache), aunque la pidan el layout, la página y las
 * acciones de servidor.
 */
export const getUserVisibility = cache(async (user: SessionUser): Promise<UserVisibility> => {
  const isSuperAdmin = user.roleName === "Super Admin";
  const [roleRows, overrideRows] = await Promise.all([
    isSuperAdmin
      ? Promise.resolve([] as { moduleKey: string }[])
      : prisma.roleModuleVisibility.findMany({
          where: { roleId: user.roleId, visible: true },
          select: { moduleKey: true },
        }),
    isSuperAdmin
      ? Promise.resolve([] as { key: string; visible: boolean }[])
      : prisma.userVisibilityOverride.findMany({ where: { userId: user.id }, select: { key: true, visible: true } }),
  ]);
  const roleModuleKeys = new Set(roleRows.map((r) => r.moduleKey));
  const overrides = Object.fromEntries(overrideRows.map((o) => [o.key, o.visible]));
  const hidden = new Set(computeHiddenKeys(roleModuleKeys, overrides, isSuperAdmin));
  const visibleModuleKeys = new Set(NAV_MODULE_KEYS.filter((k) => !hidden.has(moduleKey(k))));
  return { hidden, visibleModuleKeys };
});

/** true si la persona puede ver esa ruta (módulo + pestaña del CRM). */
export async function canSeePath(user: SessionUser, pathname: string): Promise<boolean> {
  const { hidden } = await getUserVisibility(user);
  return keysForPath(pathname).every((k) => !hidden.has(k));
}
