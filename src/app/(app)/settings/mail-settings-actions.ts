"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { getInternalMailDomain } from "@/lib/mail/config";
import type { MailRetentionPolicy } from "@prisma/client";

export interface MailAdminActionResult {
  ok: boolean;
  error?: string;
}

async function requireMailAdmin() {
  const user = await requireUser();
  if (!hasPermission(user, "mail", "admin")) {
    return { user: null, error: "No tienes permiso para administrar el correo interno." };
  }
  return { user, error: null };
}

export interface MailAdminOverview {
  domain: string;
  isEnabled: boolean;
  maxAttachmentSizeMb: number;
  allowedExtensions: string[];
  retentionPolicy: MailRetentionPolicy;
  mailboxCount: number;
  activeMailboxCount: number;
  sentCount: number;
  receivedCount: number;
  storageUsedMb: number;
}

export async function getMailAdminOverview(): Promise<MailAdminOverview | null> {
  const { user, error } = await requireMailAdmin();
  if (error) return null;
  void user;

  const [settings, mailboxCount, activeMailboxCount, sentCount, receivedCount, storageAgg] = await Promise.all([
    prisma.mailSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.internalMailbox.count(),
    prisma.internalMailbox.count({ where: { status: "ACTIVE" } }),
    prisma.internalMessage.count({ where: { isDraft: false } }),
    prisma.internalMessageRecipient.count({ where: { recipientRole: { in: ["TO", "CC"] } } }),
    prisma.internalAttachment.aggregate({ _sum: { sizeBytes: true } }),
  ]);

  return {
    domain: getInternalMailDomain(),
    isEnabled: settings.isEnabled,
    maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
    allowedExtensions: settings.allowedExtensions,
    retentionPolicy: settings.retentionPolicy,
    mailboxCount,
    activeMailboxCount,
    sentCount,
    receivedCount,
    storageUsedMb: Math.round(((storageAgg._sum.sizeBytes ?? 0) / (1024 * 1024)) * 10) / 10,
  };
}

export async function updateMailSettingsAction(input: {
  isEnabled: boolean;
  maxAttachmentSizeMb: number;
  allowedExtensions: string[];
  retentionPolicy: MailRetentionPolicy;
}): Promise<MailAdminActionResult> {
  const { error } = await requireMailAdmin();
  if (error) return { ok: false, error };

  if (input.maxAttachmentSizeMb < 1 || input.maxAttachmentSizeMb > 100) {
    return { ok: false, error: "El límite de adjuntos debe estar entre 1MB y 100MB." };
  }
  const extensions = input.allowedExtensions.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (extensions.length === 0) {
    return { ok: false, error: "Debe permitirse al menos un tipo de archivo." };
  }

  await prisma.mailSettings.upsert({
    where: { id: "singleton" },
    update: {
      isEnabled: input.isEnabled,
      maxAttachmentSizeMb: input.maxAttachmentSizeMb,
      allowedExtensions: extensions,
      retentionPolicy: input.retentionPolicy,
    },
    create: {
      id: "singleton",
      isEnabled: input.isEnabled,
      maxAttachmentSizeMb: input.maxAttachmentSizeMb,
      allowedExtensions: extensions,
      retentionPolicy: input.retentionPolicy,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/mail");
  return { ok: true };
}

export interface MailAuditRowVM {
  id: string;
  actorName: string;
  action: string;
  mailboxAddress: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: unknown;
}

export async function getMailAuditTrail(): Promise<MailAuditRowVM[]> {
  const { error } = await requireMailAdmin();
  if (error) return [];

  const rows = await prisma.mailAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, mailbox: true },
  });

  return rows.map((r) => ({
    id: r.id,
    actorName: `${r.user.firstName} ${r.user.lastName}`,
    action: r.action,
    mailboxAddress: r.mailbox ? `${r.mailbox.localPart}@${r.mailbox.domainAtCreation}` : null,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
    metadata: r.metadata,
  }));
}
