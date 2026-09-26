import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { MailAuditAction, Prisma } from "@prisma/client";

/**
 * Único punto de escritura de MailAuditLog — a propósito no se expone
 * ninguna acción de servidor que permita actualizar o borrar estas filas
 * (el brief exige que la auditoría sea inmutable para usuarios normales,
 * incluidos admins fuera de este helper). Cualquier acción del módulo de
 * correo que toque un mensaje/adjunto/buzón llama esto al final.
 */
export async function logMailAudit(entry: {
  userId: string;
  action: MailAuditAction;
  mailboxId?: string | null;
  messageId?: string | null;
  attachmentId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    // x-forwarded-for puede traer una lista "cliente, proxy1, proxy2" — el
    // primero es el cliente real.
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    userAgent = h.get("user-agent");
  } catch {
    // headers() puede no estar disponible fuera de un request (ej. un job
    // en background futuro) — la auditoría igual se guarda, sin ip/UA.
  }

  await prisma.mailAuditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      mailboxId: entry.mailboxId ?? null,
      messageId: entry.messageId ?? null,
      attachmentId: entry.attachmentId ?? null,
      ipAddress,
      userAgent,
      metadata: entry.metadata,
    },
  });
}
