import "server-only";

import { prisma } from "@/lib/db";
import { getInternalMailDomain } from "./config";
import { SYSTEM_FOLDERS } from "./folders";
import type { InternalMailbox } from "@prisma/client";

/** "Juan" + "Pérez López" -> "juan.perezLopez" -> normalizado a
 * "juan.perezlopez" (todo minúsculas, sin acentos, solo [a-z0-9.]). Distinto
 * del slugifyFieldName de custom-fields-actions.ts (ese arma camelCase para
 * una clave de objeto; esto arma un local-part de correo). */
function slugifyLocalPart(firstName: string, lastName: string): string {
  const base = `${firstName}.${lastName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  return base || "usuario";
}

/**
 * Idempotente: crea el buzón + sus 5 carpetas de sistema si el usuario
 * todavía no tiene uno, y no hace nada si ya lo tiene. Se llama:
 * 1. Al crear un usuario nuevo (users-actions.ts).
 * 2. Como backfill perezoso desde app/(app)/mail/data.ts, para cubrir
 *    cuentas que ya existían antes de esta migración sin depender de que
 *    alguien haya corrido el seed de nuevo.
 *
 * Colisión de local-part: si "juan.perez" ya existe, prueba
 * "juan.perez2", "juan.perez3"... (mismo patrón que el sufijo numérico de
 * Custom Fields) en vez de fallar o pedirle al admin que resuelva a mano.
 */
export async function ensureMailboxForUser(user: {
  id: string;
  firstName: string;
  lastName: string;
}): Promise<InternalMailbox> {
  const existing = await prisma.internalMailbox.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  const domain = getInternalMailDomain();
  const base = slugifyLocalPart(user.firstName, user.lastName);
  let localPart = base;
  for (let suffix = 2; suffix < 200; suffix++) {
    const clash = await prisma.internalMailbox.findUnique({
      where: { localPart_domainAtCreation: { localPart, domainAtCreation: domain } },
    });
    if (!clash) break;
    localPart = `${base}${suffix}`;
  }

  return prisma.$transaction(async (tx) => {
    const mailbox = await tx.internalMailbox.create({
      data: { userId: user.id, localPart, domainAtCreation: domain },
    });
    await tx.mailFolder.createMany({
      data: SYSTEM_FOLDERS.map((f) => ({
        mailboxId: mailbox.id,
        type: f.type,
        name: f.name,
        isSystem: true,
        order: f.order,
      })),
    });
    return mailbox;
  });
}

export function mailboxAddress(mailbox: Pick<InternalMailbox, "localPart" | "domainAtCreation">): string {
  return `${mailbox.localPart}@${mailbox.domainAtCreation}`;
}
