"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { RecognitionType } from "@prisma/client";

const VALID_TYPES: RecognitionType[] = [
  "PERFORMANCE",
  "LEADERSHIP",
  "EXCELLENCE",
  "GOALS",
  "TEAMWORK",
  "MENTOR",
  "MILESTONE",
  "GRATITUDE",
];

/**
 * Envía un reconocimiento a otro usuario — hoy la UI del perfil solo permite
 * verlo desde "Mi perfil" (donde el botón está deshabilitado, no tiene
 * sentido reconocerte a ti mismo), pero la acción ya queda lista para
 * cuando exista una vista de perfil de un compañero (ver comentario en
 * RecognitionCard.tsx).
 */
export async function sendRecognitionAction(
  toUserId: string,
  type: RecognitionType
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  if (!VALID_TYPES.includes(type)) {
    return { ok: false, error: "Tipo de reconocimiento inválido." };
  }
  const target = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!target) {
    return { ok: false, error: "El usuario no existe." };
  }

  await prisma.recognition.create({ data: { type, toUserId, fromUserId: user.id } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Recognition",
      entityId: toUserId,
      fieldName: "type",
      newValue: type,
    },
  });

  return { ok: true };
}
