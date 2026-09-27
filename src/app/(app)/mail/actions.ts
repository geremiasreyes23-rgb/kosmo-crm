"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission, type SessionUser } from "@/lib/auth";
import { ensureMailboxForUser, mailboxAddress } from "@/lib/mail/mailbox";
import { getInternalMailDomain, parseInternalAddress } from "@/lib/mail/config";
import { logMailAudit } from "@/lib/mail/audit";
import { getFolderMessages, type MailMessageRowVM } from "./data";
import type { InternalMailbox, MailFolderType } from "@prisma/client";

export interface MailActionResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

export interface AttachmentInput {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
}

export interface SendMessageInput {
  /** Solo al re-enviar un borrador ya guardado. */
  draftMessageId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: AttachmentInput[];
}

async function requireMailUser(action: "view" | "create" | "edit" | "delete") {
  const user = await requireUser();
  if (!hasPermission(user, "mail", action)) {
    return { user: null, error: "No tienes permiso para usar el correo interno." };
  }
  return { user, error: null };
}

async function getOwnMailbox(user: SessionUser): Promise<InternalMailbox> {
  return ensureMailboxForUser(user);
}

async function getMailSettings() {
  return prisma.mailSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Resuelve una lista de direcciones escritas en el compositor a buzones
 * reales — la ÚNICA puerta de entrada de "a quién le puede llegar un
 * correo". Cualquier dirección que no sea exactamente
 * `algo@<dominio interno vigente>` de un InternalMailbox ACTIVO existente se
 * rechaza; nunca hay un camino alterno de envío (sin SMTP, sin API externa).
 */
async function resolveRecipients(
  addresses: string[],
  currentUser: SessionUser
): Promise<{ ok: true; mailboxes: InternalMailbox[] } | { ok: false; error: string }> {
  const domain = getInternalMailDomain();
  const mailboxes: InternalMailbox[] = [];
  const seen = new Set<string>();

  for (const raw of addresses) {
    const parsed = parseInternalAddress(raw);
    if (!parsed) {
      return { ok: false, error: `"${raw}" no es una dirección válida.` };
    }
    if (parsed.domain !== domain) {
      await logMailAudit({
        userId: currentUser.id,
        action: "EXTERNAL_RECIPIENT_BLOCKED",
        metadata: { attemptedAddress: raw },
      });
      return {
        ok: false,
        error: "Los mensajes externos no están habilitados en este sistema.",
      };
    }
    const mailbox = await prisma.internalMailbox.findUnique({
      where: { localPart_domainAtCreation: { localPart: parsed.localPart, domainAtCreation: domain } },
    });
    if (!mailbox || mailbox.status !== "ACTIVE") {
      return { ok: false, error: `El destinatario "${raw}" no existe o está inactivo.` };
    }
    if (!seen.has(mailbox.id)) {
      seen.add(mailbox.id);
      mailboxes.push(mailbox);
    }
  }
  return { ok: true, mailboxes };
}

function validateAttachments(
  attachments: AttachmentInput[] | undefined,
  settings: { maxAttachmentSizeMb: number; allowedExtensions: string[] }
): string | null {
  if (!attachments?.length) return null;
  const maxBytes = settings.maxAttachmentSizeMb * 1024 * 1024;
  for (const a of attachments) {
    if (a.sizeBytes > maxBytes) {
      return `"${a.fileName}" supera el límite de ${settings.maxAttachmentSizeMb}MB por adjunto.`;
    }
    const ext = extensionOf(a.fileName);
    if (!settings.allowedExtensions.includes(ext)) {
      return `El tipo de archivo ".${ext || "?"}" no está permitido (permitidos: ${settings.allowedExtensions.join(", ")}).`;
    }
    if (!a.dataUrl.startsWith("data:")) {
      return `"${a.fileName}" no se pudo procesar. Vuelve a adjuntarlo.`;
    }
  }
  return null;
}

async function folderIdOf(mailboxId: string, type: MailFolderType): Promise<string> {
  const folder = await prisma.mailFolder.findFirst({ where: { mailboxId, type } });
  if (!folder) throw new Error(`Carpeta ${type} no encontrada para el buzón ${mailboxId}.`);
  return folder.id;
}

export async function sendMessageAction(input: SendMessageInput): Promise<MailActionResult> {
  const { user, error } = await requireMailUser("create");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const settings = await getMailSettings();
  if (!settings.isEnabled) {
    return { ok: false, error: "El módulo de correo interno está deshabilitado por el administrador." };
  }

  const subject = input.subject.trim();
  const body = input.body.trim();
  const toAddresses = (input.to ?? []).map((a) => a.trim()).filter(Boolean);
  const ccAddresses = (input.cc ?? []).map((a) => a.trim()).filter(Boolean);

  if (toAddresses.length === 0) return { ok: false, error: "Agrega al menos un destinatario en \"Para\"." };
  if (!subject) return { ok: false, error: "El asunto es obligatorio." };

  const attachmentError = validateAttachments(input.attachments, settings);
  if (attachmentError) return { ok: false, error: attachmentError };

  const toResolved = await resolveRecipients(toAddresses, user);
  if (!toResolved.ok) return { ok: false, error: toResolved.error };
  const ccResolved = ccAddresses.length ? await resolveRecipients(ccAddresses, user) : { ok: true as const, mailboxes: [] };
  if (!ccResolved.ok) return { ok: false, error: ccResolved.error };

  const senderMailbox = await getOwnMailbox(user);
  const senderSentFolderId = await folderIdOf(senderMailbox.id, "SENT");

  // Reverifica en el backend que el borrador que se está enviando sea del
  // PROPIO remitente antes de tocarlo — nunca confía en que el
  // draftMessageId que mandó el cliente es legítimo (protección IDOR).
  if (input.draftMessageId) {
    const draft = await prisma.internalMessage.findUnique({ where: { id: input.draftMessageId } });
    if (!draft || draft.senderId !== senderMailbox.id || !draft.isDraft) {
      return { ok: false, error: "Borrador no encontrado." };
    }
  }

  const toIds = new Set(toResolved.mailboxes.map((m) => m.id));
  const ccOnly = ccResolved.mailboxes.filter((m) => !toIds.has(m.id));

  const message = await prisma.$transaction(async (tx) => {
    const msg = input.draftMessageId
      ? await tx.internalMessage.update({
          where: { id: input.draftMessageId },
          data: {
            subject,
            body,
            isDraft: false,
            sentAt: new Date(),
            draftToAddresses: toAddresses,
            draftCcAddresses: ccAddresses,
          },
        })
      : await tx.internalMessage.create({
          data: {
            senderId: senderMailbox.id,
            subject,
            body,
            isDraft: false,
            sentAt: new Date(),
            draftToAddresses: toAddresses,
            draftCcAddresses: ccAddresses,
          },
        });

    // Si venía de un borrador, su copia ya existe en Borradores — la
    // reubicamos a Enviados en vez de crear una copia duplicada.
    if (input.draftMessageId) {
      await tx.internalMessageRecipient.updateMany({
        where: { messageId: msg.id, mailboxId: senderMailbox.id, recipientRole: "FROM" },
        data: { folderId: senderSentFolderId, isRead: true, readAt: new Date() },
      });
    } else {
      await tx.internalMessageRecipient.create({
        data: {
          messageId: msg.id,
          mailboxId: senderMailbox.id,
          folderId: senderSentFolderId,
          recipientRole: "FROM",
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    for (const m of input.attachments ?? []) {
      await tx.internalAttachment.create({
        data: { messageId: msg.id, fileName: m.fileName, mimeType: m.mimeType, sizeBytes: m.sizeBytes, dataUrl: m.dataUrl },
      });
    }

    for (const mailbox of toResolved.mailboxes) {
      const inboxId = await folderIdOf(mailbox.id, "INBOX");
      await tx.internalMessageRecipient.create({
        data: { messageId: msg.id, mailboxId: mailbox.id, folderId: inboxId, recipientRole: "TO" },
      });
    }
    for (const mailbox of ccOnly) {
      const inboxId = await folderIdOf(mailbox.id, "INBOX");
      await tx.internalMessageRecipient.create({
        data: { messageId: msg.id, mailboxId: mailbox.id, folderId: inboxId, recipientRole: "CC" },
      });
    }

    return msg;
  });

  await logMailAudit({ userId: user.id, action: "MESSAGE_CREATED", mailboxId: senderMailbox.id, messageId: message.id });
  await logMailAudit({ userId: user.id, action: "MESSAGE_SENT", mailboxId: senderMailbox.id, messageId: message.id });

  // Notificación en el centro de notificaciones del CRM (Notification, ya
  // existente) — el contenido nunca lleva datos sensibles del cliente ni el
  // cuerpo del correo, solo quién escribió y el asunto.
  const senderName = `${user.firstName} ${user.lastName}`;
  const allRecipientMailboxes = [...toResolved.mailboxes, ...ccOnly];
  await prisma.notification.createMany({
    data: allRecipientMailboxes.map((m) => ({
      userId: m.userId,
      type: "internal_mail",
      title: "Nuevo correo interno",
      message: `${senderName}: ${subject}`,
      relatedEntityType: "InternalMessage",
      relatedEntityId: message.id,
    })),
  });

  revalidatePath("/mail");
  return { ok: true, messageId: message.id };
}

export async function saveDraftAction(input: Omit<SendMessageInput, "to"> & { to?: string[] }): Promise<MailActionResult> {
  const { user, error } = await requireMailUser("create");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const senderMailbox = await getOwnMailbox(user);
  const subject = input.subject.trim();
  const body = input.body.trim();
  const toAddresses = (input.to ?? []).map((a) => a.trim()).filter(Boolean);
  const ccAddresses = (input.cc ?? []).map((a) => a.trim()).filter(Boolean);
  const draftsFolderId = await folderIdOf(senderMailbox.id, "DRAFTS");

  // Mismo reverificación IDOR que en sendMessageAction — nunca confía en que
  // el draftMessageId recibido pertenece a quien hace la petición.
  if (input.draftMessageId) {
    const draft = await prisma.internalMessage.findUnique({ where: { id: input.draftMessageId } });
    if (!draft || draft.senderId !== senderMailbox.id || !draft.isDraft) {
      return { ok: false, error: "Borrador no encontrado." };
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = input.draftMessageId
      ? await tx.internalMessage.update({
          where: { id: input.draftMessageId },
          data: { subject, body, draftToAddresses: toAddresses, draftCcAddresses: ccAddresses },
        })
      : await tx.internalMessage.create({
          data: {
            senderId: senderMailbox.id,
            subject,
            body,
            isDraft: true,
            draftToAddresses: toAddresses,
            draftCcAddresses: ccAddresses,
          },
        });

    if (!input.draftMessageId) {
      await tx.internalMessageRecipient.create({
        data: { messageId: msg.id, mailboxId: senderMailbox.id, folderId: draftsFolderId, recipientRole: "FROM", isRead: true },
      });
    }

    for (const m of input.attachments ?? []) {
      await tx.internalAttachment.create({
        data: { messageId: msg.id, fileName: m.fileName, mimeType: m.mimeType, sizeBytes: m.sizeBytes, dataUrl: m.dataUrl },
      });
    }
    return msg;
  });

  revalidatePath("/mail");
  return { ok: true, messageId: message.id };
}

export interface MailMessageDetailVM {
  id: string;
  subject: string;
  body: string;
  senderName: string;
  senderAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  timestamp: string;
  isDraft: boolean;
  isOwnCopy: boolean;
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
}

export async function getMessageDetailAction(recipientRowId: string): Promise<
  { ok: true; message: MailMessageDetailVM } | { ok: false; error: string }
> {
  const { user, error } = await requireMailUser("view");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const row = await prisma.internalMessageRecipient.findUnique({
    where: { id: recipientRowId },
    include: {
      mailbox: true,
      message: {
        include: {
          sender: { include: { user: true } },
          attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
        },
      },
    },
  });
  if (!row || row.mailbox.userId !== user.id) {
    // Nunca revela si la fila existe pero es de otro usuario — mismo
    // principio que getLeadForUser: "no se puede ver" y "no existe" se ven
    // igual desde afuera.
    return { ok: false, error: "Correo no encontrado." };
  }

  if (!row.isRead && row.recipientRole !== "FROM") {
    await prisma.internalMessageRecipient.update({
      where: { id: row.id },
      data: { isRead: true, readAt: new Date() },
    });
    await logMailAudit({
      userId: user.id,
      action: "MESSAGE_READ",
      mailboxId: row.mailboxId,
      messageId: row.messageId,
    });
  }

  return {
    ok: true,
    message: {
      id: row.message.id,
      subject: row.message.subject || "(sin asunto)",
      body: row.message.body,
      senderName: `${row.message.sender.user.firstName} ${row.message.sender.user.lastName}`,
      senderAddress: mailboxAddress(row.message.sender),
      toAddresses: row.message.draftToAddresses,
      ccAddresses: row.message.draftCcAddresses,
      timestamp: (row.message.sentAt ?? row.message.createdAt).toISOString(),
      isDraft: row.message.isDraft,
      isOwnCopy: row.recipientRole === "FROM",
      attachments: row.message.attachments,
    },
  };
}

export async function moveMessageAction(
  recipientRowId: string,
  target: "ARCHIVE" | "TRASH" | "INBOX"
): Promise<MailActionResult> {
  const { user, error } = await requireMailUser("delete");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const row = await prisma.internalMessageRecipient.findUnique({ where: { id: recipientRowId }, include: { mailbox: true } });
  if (!row || row.mailbox.userId !== user.id) return { ok: false, error: "Correo no encontrado." };

  const targetFolderId = await folderIdOf(row.mailboxId, target);
  await prisma.internalMessageRecipient.update({
    where: { id: row.id },
    data: { folderId: targetFolderId, isDeleted: target === "TRASH" },
  });

  await logMailAudit({
    userId: user.id,
    action: target === "TRASH" ? "MESSAGE_DELETED" : "MESSAGE_ARCHIVED",
    mailboxId: row.mailboxId,
    messageId: row.messageId,
    metadata: { to: target },
  });

  revalidatePath("/mail");
  return { ok: true };
}

export async function permanentlyDeleteMessageAction(recipientRowId: string): Promise<MailActionResult> {
  const { user, error } = await requireMailUser("delete");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const row = await prisma.internalMessageRecipient.findUnique({ where: { id: recipientRowId }, include: { mailbox: true } });
  if (!row || row.mailbox.userId !== user.id) return { ok: false, error: "Correo no encontrado." };
  if (!row.isDeleted) return { ok: false, error: "Solo se puede eliminar en forma permanente desde la Papelera." };

  await prisma.internalMessageRecipient.delete({ where: { id: row.id } });

  // Si ya nadie más tiene una copia de este mensaje, no queda razón para
  // conservar el mensaje/adjuntos huérfanos.
  const remaining = await prisma.internalMessageRecipient.count({ where: { messageId: row.messageId } });
  if (remaining === 0) {
    await prisma.internalMessage.delete({ where: { id: row.messageId } }).catch(() => {});
  }

  await logMailAudit({
    userId: user.id,
    action: "MESSAGE_DELETED",
    mailboxId: row.mailboxId,
    messageId: row.messageId,
    metadata: { permanent: true },
  });

  revalidatePath("/mail");
  return { ok: true };
}

export async function downloadAttachmentAction(
  attachmentId: string
): Promise<{ ok: true; fileName: string; mimeType: string; dataUrl: string } | { ok: false; error: string }> {
  const { user, error } = await requireMailUser("view");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const attachment = await prisma.internalAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { include: { recipients: { include: { mailbox: true } } } } },
  });
  if (!attachment) return { ok: false, error: "Adjunto no encontrado." };

  // Reverifica en el backend que el usuario sea dueño de AL MENOS una copia
  // de este mensaje (remitente o algún destinatario) — nunca confía en que
  // el frontend ya "sabía" que podía verlo.
  const owns = attachment.message.recipients.some((r) => r.mailbox.userId === user.id);
  if (!owns) return { ok: false, error: "No tienes acceso a este adjunto." };

  await logMailAudit({ userId: user.id, action: "ATTACHMENT_DOWNLOADED", messageId: attachment.messageId, attachmentId: attachment.id });

  return { ok: true, fileName: attachment.fileName, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl };
}

/** Cambio de carpeta desde el sidebar del cliente — reverifica que la
 * carpeta pedida sea del PROPIO buzón antes de devolver nada. */
export async function loadFolderMessagesAction(
  folderId: string
): Promise<{ ok: true; messages: MailMessageRowVM[] } | { ok: false; error: string }> {
  const { user, error } = await requireMailUser("view");
  if (error) return { ok: false, error };
  if (!user) return { ok: false, error: "No autorizado." };

  const mailbox = await getOwnMailbox(user);
  const folder = await prisma.mailFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.mailboxId !== mailbox.id) return { ok: false, error: "Carpeta no encontrada." };

  const messages = await getFolderMessages(mailbox.id, folderId, user.id);
  return { ok: true, messages };
}

/**
 * Acceso excepcional de un Admin al buzón de otro usuario — el brief exige
 * que NUNCA sea automático ni implícito por rol, así que esto pide un motivo
 * obligatorio y queda auditado como ADMIN_ACCESS_GRANTED antes de devolver
 * un solo dato. Versión v1, de un solo paso (el propio admin certifica el
 * motivo) — un flujo de aprobación por un segundo admin queda para la fase
 * de hardening, no bloquea esta entrega funcional.
 */
export async function adminInspectMailboxAction(
  targetUserId: string,
  reason: string
): Promise<{ ok: true; address: string; messages: { subject: string; from: string; to: string; sentAt: string | null }[] } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!hasPermission(user, "mail", "admin")) {
    return { ok: false, error: "No tienes permiso para administrar el correo interno." };
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return { ok: false, error: "Escribe un motivo (mínimo 10 caracteres): queda registrado en la auditoría." };
  }

  const mailbox = await prisma.internalMailbox.findUnique({ where: { userId: targetUserId } });
  if (!mailbox) return { ok: false, error: "Ese usuario no tiene buzón." };

  await logMailAudit({
    userId: user.id,
    action: "ADMIN_ACCESS_GRANTED",
    mailboxId: mailbox.id,
    metadata: { reason: trimmedReason, targetUserId },
  });
  await logMailAudit({ userId: user.id, action: "MAILBOX_ACCESSED", mailboxId: mailbox.id, metadata: { onBehalfOf: user.id } });

  const rows = await prisma.internalMessageRecipient.findMany({
    where: { mailboxId: mailbox.id, isDeleted: false },
    include: { message: { include: { sender: { include: { user: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    ok: true,
    address: mailboxAddress(mailbox),
    messages: rows.map((r) => ({
      subject: r.message.subject || "(sin asunto)",
      from: `${r.message.sender.user.firstName} ${r.message.sender.user.lastName}`,
      to: r.recipientRole,
      sentAt: r.message.sentAt ? r.message.sentAt.toISOString() : null,
    })),
  };
}
