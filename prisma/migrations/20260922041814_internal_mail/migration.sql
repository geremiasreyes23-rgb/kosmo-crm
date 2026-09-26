-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MailFolderType" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MailRecipientRole" AS ENUM ('TO', 'CC', 'FROM');

-- CreateEnum
CREATE TYPE "MailAuditAction" AS ENUM ('MESSAGE_CREATED', 'MESSAGE_SENT', 'MESSAGE_READ', 'MESSAGE_DELETED', 'MESSAGE_ARCHIVED', 'ATTACHMENT_UPLOADED', 'ATTACHMENT_DOWNLOADED', 'ATTACHMENT_DELETED', 'MAILBOX_ACCESSED', 'EXTERNAL_RECIPIENT_BLOCKED', 'ADMIN_ACCESS_GRANTED');

-- CreateEnum
CREATE TYPE "MailRetentionPolicy" AS ENUM ('DAYS_30', 'DAYS_90', 'YEAR_1', 'INDEFINITE');

-- CreateTable
CREATE TABLE "InternalMailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "domainAtCreation" TEXT NOT NULL,
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "InternalMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailFolder" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "type" "MailFolderType" NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "draftToAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "draftCcAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "recipientRole" "MailRecipientRole" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "action" "MailAuditAction" NOT NULL,
    "messageId" TEXT,
    "attachmentId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxAttachmentSizeMb" INTEGER NOT NULL DEFAULT 10,
    "allowedExtensions" TEXT[] DEFAULT ARRAY['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx']::TEXT[],
    "retentionPolicy" "MailRetentionPolicy" NOT NULL DEFAULT 'INDEFINITE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalMailbox_userId_key" ON "InternalMailbox"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalMailbox_localPart_domainAtCreation_key" ON "InternalMailbox"("localPart", "domainAtCreation");

-- CreateIndex
CREATE INDEX "MailFolder_mailboxId_idx" ON "MailFolder"("mailboxId");

-- CreateIndex
CREATE UNIQUE INDEX "MailFolder_mailboxId_type_name_key" ON "MailFolder"("mailboxId", "type", "name");

-- CreateIndex
CREATE INDEX "InternalMessage_senderId_createdAt_idx" ON "InternalMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalMessageRecipient_mailboxId_folderId_idx" ON "InternalMessageRecipient"("mailboxId", "folderId");

-- CreateIndex
CREATE INDEX "InternalMessageRecipient_messageId_idx" ON "InternalMessageRecipient"("messageId");

-- CreateIndex
CREATE INDEX "InternalAttachment_messageId_idx" ON "InternalAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MailAuditLog_userId_createdAt_idx" ON "MailAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MailAuditLog_mailboxId_createdAt_idx" ON "MailAuditLog"("mailboxId", "createdAt");

-- AddForeignKey
ALTER TABLE "InternalMailbox" ADD CONSTRAINT "InternalMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailFolder" ADD CONSTRAINT "MailFolder_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "InternalMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "InternalMailbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageRecipient" ADD CONSTRAINT "InternalMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InternalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageRecipient" ADD CONSTRAINT "InternalMessageRecipient_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "InternalMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageRecipient" ADD CONSTRAINT "InternalMessageRecipient_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MailFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAttachment" ADD CONSTRAINT "InternalAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InternalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAuditLog" ADD CONSTRAINT "MailAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAuditLog" ADD CONSTRAINT "MailAuditLog_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "InternalMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
