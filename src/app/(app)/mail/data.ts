import "server-only";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ensureMailboxForUser } from "@/lib/mail/mailbox";
import { mailboxAddress } from "@/lib/mail/mailbox";
import type { MailFolderType } from "@prisma/client";

export interface MailFolderVM {
  id: string;
  type: MailFolderType;
  name: string;
  unreadCount: number;
}

export interface MailMessageRowVM {
  /** id de InternalMessageRecipient — identifica la COPIA del mensaje en esta
   * carpeta, no el mensaje en sí (dos personas pueden tener el mismo
   * messageId en carpetas distintas). */
  id: string;
  messageId: string;
  subject: string;
  snippet: string;
  counterpartName: string;
  counterpartAddress: string;
  isRead: boolean;
  hasAttachments: boolean;
  isDraft: boolean;
  timestamp: string;
}

export interface MailOverview {
  mailboxId: string;
  address: string;
  folders: MailFolderVM[];
  activeFolder: MailFolderVM;
  messages: MailMessageRowVM[];
}

function snippetOf(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
}

/** Buzón del usuario actual — lo crea si todavía no existe (backfill
 * perezoso para cuentas que ya existían antes de este módulo). */
export async function getOrCreateMailbox(user: SessionUser) {
  return ensureMailboxForUser(user);
}

export async function getFolders(mailboxId: string): Promise<MailFolderVM[]> {
  const folders = await prisma.mailFolder.findMany({
    where: { mailboxId },
    orderBy: { order: "asc" },
    include: {
      _count: {
        select: { recipients: { where: { isRead: false, isDeleted: false } } },
      },
    },
  });
  return folders.map((f) => ({
    id: f.id,
    type: f.type,
    name: f.name,
    // El conteo de "no leídos" solo tiene sentido visual en Recibidos —
    // Enviados/Borradores/Archivados/Papelera nunca muestran una burbuja roja.
    unreadCount: f.type === "INBOX" ? f._count.recipients : 0,
  }));
}

export async function getFolderMessages(
  mailboxId: string,
  folderId: string,
  currentUserId: string
): Promise<MailMessageRowVM[]> {
  // Sin filtrar por isDeleted acá a propósito: folderId YA determina qué se
  // ve en cada carpeta (moveMessageAction siempre mueve folderId e isDeleted
  // juntos — Papelera ⟺ isDeleted=true), así que filtrar isDeleted=false de
  // forma global dejaría la Papelera vacía siempre. isDeleted queda
  // reservado para el futuro job de retención (MailSettings.retentionPolicy).
  const rows = await prisma.internalMessageRecipient.findMany({
    where: { mailboxId, folderId },
    include: {
      message: {
        include: {
          sender: { include: { user: true } },
          attachments: { select: { id: true } },
          recipients: {
            where: { recipientRole: { in: ["TO", "CC"] } },
            include: { mailbox: { include: { user: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => {
    const msg = r.message;
    const isOwnSentCopy = r.recipientRole === "FROM";
    let counterpartName: string;
    let counterpartAddress: string;
    if (isOwnSentCopy) {
      if (msg.isDraft) {
        // Un borrador todavía no tiene filas InternalMessageRecipient reales
        // para sus destinatarios (esas solo se crean al enviar) — se muestra
        // lo que se escribió en el compositor.
        counterpartName = msg.draftToAddresses.length ? msg.draftToAddresses.join(", ") : "Sin destinatarios";
        counterpartAddress = counterpartName;
      } else {
        const names = msg.recipients.map((rec) => `${rec.mailbox.user.firstName} ${rec.mailbox.user.lastName}`);
        counterpartName = names.length ? names.join(", ") : "Sin destinatarios";
        counterpartAddress = msg.recipients.map((rec) => mailboxAddress(rec.mailbox)).join(", ");
      }
    } else {
      counterpartName = `${msg.sender.user.firstName} ${msg.sender.user.lastName}`;
      counterpartAddress = mailboxAddress(msg.sender);
    }
    return {
      id: r.id,
      messageId: msg.id,
      subject: msg.subject || "(sin asunto)",
      snippet: snippetOf(msg.body),
      counterpartName,
      counterpartAddress,
      isRead: r.isRead,
      hasAttachments: msg.attachments.length > 0,
      isDraft: msg.isDraft,
      timestamp: (msg.sentAt ?? msg.createdAt).toISOString(),
    };
  });
}

export async function getMailOverview(user: SessionUser, folderType: MailFolderType = "INBOX"): Promise<MailOverview> {
  const mailbox = await getOrCreateMailbox(user);
  const folders = await getFolders(mailbox.id);
  const activeFolder = folders.find((f) => f.type === folderType) ?? folders[0];
  const messages = await getFolderMessages(mailbox.id, activeFolder.id, user.id);
  return {
    mailboxId: mailbox.id,
    address: mailboxAddress(mailbox),
    folders,
    activeFolder,
    messages,
  };
}

export interface MailSettingsVM {
  isEnabled: boolean;
  maxAttachmentSizeMb: number;
  allowedExtensions: string[];
}

export async function getMailSettingsVM(): Promise<MailSettingsVM> {
  const settings = await prisma.mailSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  return {
    isEnabled: settings.isEnabled,
    maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
    allowedExtensions: settings.allowedExtensions,
  };
}

export interface MailRecipientOption {
  id: string;
  name: string;
  address: string;
  department: string | null;
  jobTitle: string | null;
  roleName: string;
}

/** Directorio para el autocompletado de Para/CC — solo usuarios con buzón
 * ACTIVO (coherente con "no se puede escribir a alguien desactivado"). */
export async function getComposeDirectory(excludeUserId: string): Promise<MailRecipientOption[]> {
  const mailboxes = await prisma.internalMailbox.findMany({
    where: { status: "ACTIVE", userId: { not: excludeUserId }, user: { status: "ACTIVE" } },
    include: { user: { include: { role: true } } },
    orderBy: { user: { firstName: "asc" } },
  });
  return mailboxes.map((m) => ({
    id: m.id,
    name: `${m.user.firstName} ${m.user.lastName}`,
    address: mailboxAddress(m),
    department: m.user.department,
    jobTitle: m.user.jobTitle,
    roleName: m.user.role.name,
  }));
}
