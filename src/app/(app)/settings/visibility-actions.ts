"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isVisibilityKey } from "@/lib/visibility";

/**
 * Configuración → Visibilidad por usuario. Guarda las EXCEPCIONES de cada
 * persona respecto de su rol (UserVisibilityOverride). "inherit" borra la
 * excepción y vuelve a lo que diga el rol.
 */

const MANAGER_ROLES = ["Super Admin", "Admin"];

export interface VisibilityActionResult {
  ok: boolean;
  error?: string;
}

async function guard(targetUserId: string): Promise<{ currentId: string } | { error: string }> {
  const current = await requireUser();
  if (!MANAGER_ROLES.includes(current.roleName)) return { error: "No tienes permiso para configurar la visibilidad." };
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: { select: { name: true } } } });
  if (!target) return { error: "El usuario ya no existe." };
  if (target.role.name === "Super Admin") return { error: "El Super Admin siempre ve todo; no se le pueden ocultar elementos." };
  if (target.role.name === "Admin" && current.roleName !== "Super Admin") {
    return { error: "Solo un Super Admin puede configurar la visibilidad de un Admin." };
  }
  return { currentId: current.id };
}

export async function setUserVisibilityAction(input: {
  userId: string;
  key: string;
  value: "inherit" | "show" | "hide";
}): Promise<VisibilityActionResult> {
  if (!isVisibilityKey(input.key)) return { ok: false, error: "Elemento no válido." };
  const g = await guard(input.userId);
  if ("error" in g) return { ok: false, error: g.error };

  if (input.value === "inherit") {
    await prisma.userVisibilityOverride.deleteMany({ where: { userId: input.userId, key: input.key } });
  } else {
    const visible = input.value === "show";
    await prisma.userVisibilityOverride.upsert({
      where: { userId_key: { userId: input.userId, key: input.key } },
      update: { visible },
      create: { userId: input.userId, key: input.key, visible },
    });
  }
  await logAudit({
    userId: g.currentId,
    action: "UPDATE",
    entityType: "User",
    entityId: input.userId,
    fieldName: `visibility:${input.key}`,
    newValue: input.value,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetUserVisibilityAction(userId: string): Promise<VisibilityActionResult> {
  const g = await guard(userId);
  if ("error" in g) return { ok: false, error: g.error };
  await prisma.userVisibilityOverride.deleteMany({ where: { userId } });
  await logAudit({ userId: g.currentId, action: "UPDATE", entityType: "User", entityId: userId, fieldName: "visibility:reset" });
  revalidatePath("/settings");
  return { ok: true };
}

/** Copia las excepciones de una persona a otra (ej. configurar a un nuevo
 * "submitter" igual que otro que ya existe). */
export async function copyUserVisibilityAction(fromUserId: string, toUserId: string): Promise<VisibilityActionResult> {
  if (fromUserId === toUserId) return { ok: false, error: "Elige otra persona." };
  const g = await guard(toUserId);
  if ("error" in g) return { ok: false, error: g.error };
  const rows = await prisma.userVisibilityOverride.findMany({ where: { userId: fromUserId } });
  await prisma.$transaction([
    prisma.userVisibilityOverride.deleteMany({ where: { userId: toUserId } }),
    prisma.userVisibilityOverride.createMany({
      data: rows.map((r) => ({ userId: toUserId, key: r.key, visible: r.visible })),
    }),
  ]);
  await logAudit({ userId: g.currentId, action: "UPDATE", entityType: "User", entityId: toUserId, fieldName: "visibility:copy", newValue: fromUserId });
  revalidatePath("/settings");
  return { ok: true };
}
