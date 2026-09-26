"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ThemeName } from "@prisma/client";
import { THEME_NAMES } from "@/lib/themes";

/**
 * Guarda el tema visual elegido por el usuario (Avatar → Tema del sistema).
 * Puramente cosmético: no toca permisos, RBAC ni ningún otro dato — un
 * único campo (`User.themePreference`) que la interfaz lee para decidir
 * qué variables --brand-* y --theme-* aplicar (ver ThemeProvider.tsx).
 *
 * ThemeProvider ya aplica el cambio de forma optimista en el cliente antes
 * de llamar a esta acción (para que se sienta instantáneo, sin esperar al
 * servidor) — esta acción solo persiste esa elección para que sobreviva a
 * cerrar sesión / recargar / volver a entrar, tal como pide el punto 13.
 */
export async function setThemePreferenceAction(
  theme: ThemeName
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  if (!THEME_NAMES.includes(theme)) {
    return { ok: false, error: "Tema inválido." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { themePreference: theme },
  });

  return { ok: true };
}
