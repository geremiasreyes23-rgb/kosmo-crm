"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword, generateTempPassword } from "@/lib/auth";
import { ensureMailboxForUser } from "@/lib/mail/mailbox";
import { logAudit } from "@/lib/audit";

const MANAGER_ROLES = ["Super Admin", "Admin"];

async function requireUserManager() {
  const current = await requireUser();
  if (!MANAGER_ROLES.includes(current.roleName)) {
    return { current: null, error: "No tienes permiso para gestionar usuarios." };
  }
  return { current, error: null };
}

async function activeSuperAdminCount(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      status: "ACTIVE",
      role: { name: "Super Admin" },
      id: excludeUserId ? { not: excludeUserId } : undefined,
    },
  });
}

export interface UserActionResult {
  ok: boolean;
  error?: string;
  tempPassword?: string;
}

export async function createUserAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
}): Promise<UserActionResult> {
  const { current, error } = await requireUserManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();

  if (!firstName || !lastName || !email || !input.roleId) {
    return { ok: false, error: "Completa nombre, apellido, correo y rol." };
  }

  // Fase 15 (auditoría de seguridad) — sin esto, un Admin podía crear una
  // cuenta Super Admin nueva pasando ese roleId a mano (la UI no ofrece esa
  // opción, pero la Server Action no lo impedía). Solo un Super Admin puede
  // otorgar el rol Super Admin.
  const targetRole = await prisma.role.findUnique({ where: { id: input.roleId }, select: { name: true } });
  if (!targetRole) return { ok: false, error: "El rol seleccionado no es válido." };
  if (targetRole.name === "Super Admin" && current.roleName !== "Super Admin") {
    return { ok: false, error: "Solo un Super Admin puede crear otra cuenta Super Admin." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con ese correo." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Todo usuario del sistema es también "Agente" (para poder asignarle
  // leads, pólizas y comisiones) — se crea junto con el usuario, sin
  // pantalla aparte, tal como se decidió para la Fase 3.
  const newUser = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: { firstName, lastName, email, isSeller: true, status: "ACTIVE" },
    });
    return tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        roleId: input.roleId,
        passwordHash,
        mustChangePassword: true,
        status: "ACTIVE",
        agentId: agent.id,
      },
    });
  });

  // Correo interno: todo usuario nuevo recibe su buzón automáticamente
  // (usuario_id como llave, dirección derivada de nombre+apellido, con
  // sufijo numérico si ya existe — ver ensureMailboxForUser). Corre fuera de
  // la transacción de arriba porque ensureMailboxForUser abre la suya
  // propia y depende de que el usuario ya exista.
  await ensureMailboxForUser(newUser);
  await logAudit({ userId: current.id, action: "CREATE", entityType: "User", entityId: newUser.id, newValue: email });

  revalidatePath("/settings");
  return { ok: true, tempPassword };
}

export async function updateUserAction(
  userId: string,
  input: { firstName: string; lastName: string; email: string; roleId: string }
): Promise<UserActionResult> {
  const { current, error } = await requireUserManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();

  if (!firstName || !lastName || !email || !input.roleId) {
    return { ok: false, error: "Completa nombre, apellido, correo y rol." };
  }

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId) {
    return { ok: false, error: "Ese correo ya lo usa otro usuario." };
  }

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true, role: { select: { name: true } } } });

  // Fase 15 (auditoría de seguridad) — mismo guard que createUserAction: un
  // Admin no puede ascender a nadie a Super Admin. Además, si el objetivo
  // YA es Super Admin y el nuevo rol no lo es, hay que asegurarse de que no
  // sea el último (mismo criterio que setUserStatusAction al desactivar).
  if (before?.roleId !== input.roleId) {
    const targetRole = await prisma.role.findUnique({ where: { id: input.roleId }, select: { name: true } });
    if (!targetRole) return { ok: false, error: "El rol seleccionado no es válido." };
    if (targetRole.name === "Super Admin" && current.roleName !== "Super Admin") {
      return { ok: false, error: "Solo un Super Admin puede asignar el rol Super Admin." };
    }
    if (before?.role.name === "Super Admin" && targetRole.name !== "Super Admin") {
      const remaining = await activeSuperAdminCount(userId);
      if (remaining === 0) {
        return { ok: false, error: "Debe quedar al menos un Super Admin activo — no puedes cambiarle el rol al último." };
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { firstName, lastName, email, roleId: input.roleId },
  });

  // Mantiene el registro de Agente (nombre/correo) en sincronía — es el
  // mismo "yo" comercial que el usuario, no un catálogo aparte.
  if (updated.agentId) {
    await prisma.agent.update({
      where: { id: updated.agentId },
      data: { firstName, lastName, email },
    });
  }
  await logAudit({ userId: current.id, action: "UPDATE", entityType: "User", entityId: userId, fieldName: "profile" });
  if (before && before.roleId !== input.roleId) {
    await logAudit({
      userId: current.id,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      fieldName: "roleId",
      oldValue: before.roleId,
      newValue: input.roleId,
    });
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserStatusAction(
  userId: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<UserActionResult> {
  const { current, error } = await requireUserManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  if (userId === current.id) {
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  }

  if (status === "INACTIVE") {
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (target?.role.name === "Super Admin") {
      const remaining = await activeSuperAdminCount(userId);
      if (remaining === 0) {
        return { ok: false, error: "Debe quedar al menos un Super Admin activo." };
      }
    }
    // Desactivar corta el acceso al instante: borramos sus sesiones activas.
    await prisma.session.deleteMany({ where: { userId } });
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  if (updated.agentId) {
    await prisma.agent.update({
      where: { id: updated.agentId },
      data: { status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE" },
    });
  }
  await logAudit({
    userId: current.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    fieldName: "status",
    newValue: status,
  });

  // Correo interno: al desactivar un usuario, su buzón se marca DISABLED en
  // vez de borrarse — conserva el historial (retención) y evita reasignar
  // esa dirección a otra persona por error. Al reactivarlo, vuelve a ACTIVE.
  await prisma.internalMailbox.updateMany({
    where: { userId },
    data:
      status === "INACTIVE"
        ? { status: "DISABLED", disabledAt: new Date() }
        : { status: "ACTIVE", disabledAt: null },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function resetPasswordAction(userId: string): Promise<UserActionResult> {
  const { current, error } = await requireUserManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });
  // Fuerza a re-loguearse con la contraseña nueva.
  await prisma.session.deleteMany({ where: { userId } });
  await logAudit({ userId: current.id, action: "UPDATE", entityType: "User", entityId: userId, fieldName: "passwordReset" });

  revalidatePath("/settings");
  return { ok: true, tempPassword };
}

export async function deleteUserAction(userId: string): Promise<UserActionResult> {
  const { current, error } = await requireUserManager();
  if (error) return { ok: false, error };
  if (!current) return { ok: false, error: "No autorizado." };

  if (userId === current.id) {
    return { ok: false, error: "No puedes eliminar tu propia cuenta." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (target?.role.name === "Super Admin") {
    const remaining = await activeSuperAdminCount(userId);
    if (remaining === 0) {
      return { ok: false, error: "Debe quedar al menos un Super Admin activo." };
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // Restricción de llave foránea: el usuario tiene historial (leads,
    // ventas, auditoría, documentos...) — no se puede borrar sin perder
    // trazabilidad. Se le pide al admin desactivar en su lugar.
    return {
      ok: false,
      error:
        "No se puede eliminar: este usuario tiene historial en el sistema (leads, ventas, auditoría, etc.). Desactívalo en su lugar para revocar su acceso.",
    };
  }
  // El registro de auditoría queda con userId = quien borró (no el usuario
  // borrado, que ya no existe) — entityId conserva el id del usuario
  // eliminado para que el rastro siga siendo consultable.
  await logAudit({ userId: current.id, action: "DELETE", entityType: "User", entityId: userId });

  revalidatePath("/settings");
  return { ok: true };
}
