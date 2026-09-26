"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
// ~1.5 MB de imagen real, ya codificada en base64 (que pesa ~33% más que el
// archivo original) — deja margen razonable sin dejar crecer la fila de
// User sin control.
const MAX_AVATAR_DATA_URL_LENGTH = 2_100_000;

/**
 * Sube la foto de perfil como data URL (imagen embebida directo en la base
 * de datos) — no hay almacenamiento de archivos/objetos configurado todavía,
 * así que esta es la forma más simple de tener fotos funcionando ya, sin
 * depender de un servicio externo. Si el equipo crece mucho se puede migrar
 * a un bucket de objetos más adelante sin cambiar la interfaz de esta acción.
 */
export async function updateAvatarAction(
  dataUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl);
  if (!match || !ALLOWED_AVATAR_TYPES.includes(match[1])) {
    return { ok: false, error: "Formato de imagen no soportado — usa JPG, PNG o WEBP." };
  }
  if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
    return { ok: false, error: "La imagen es muy pesada — usa una de menos de 1.5 MB." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: dataUrl } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, fieldName: "avatarUrl" },
  });
  return { ok: true };
}

// La portada es una imagen ancha (banner), así que se le da algo más de
// margen que al avatar — mismo criterio de peso que ya se usa para fotos de
// Mensajería (3 MB de archivo real).
const MAX_COVER_DATA_URL_LENGTH = 4_200_000;

/** Mismo patrón que updateAvatarAction — actualiza User.coverPhotoUrl, el
 * banner que se ve arriba del avatar en "Mi perfil" (ProfileModal). */
export async function updateCoverPhotoAction(
  dataUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl);
  if (!match || !ALLOWED_AVATAR_TYPES.includes(match[1])) {
    return { ok: false, error: "Formato de imagen no soportado — usa JPG, PNG o WEBP." };
  }
  if (dataUrl.length > MAX_COVER_DATA_URL_LENGTH) {
    return { ok: false, error: "La imagen es muy pesada — usa una de menos de 3 MB." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { coverPhotoUrl: dataUrl } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, fieldName: "coverPhotoUrl" },
  });
  return { ok: true };
}

export async function updateProfileAction(input: {
  jobTitle: string;
  phone: string;
  birthday: string; // "yyyy-mm-dd" o ""
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  let birthday: Date | null = null;
  if (input.birthday) {
    const parsed = new Date(`${input.birthday}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Fecha de cumpleaños inválida." };
    }
    birthday = parsed;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      jobTitle: input.jobTitle.trim() || null,
      phone: input.phone.trim() || null,
      birthday,
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, fieldName: "profile" },
  });
  return { ok: true };
}
