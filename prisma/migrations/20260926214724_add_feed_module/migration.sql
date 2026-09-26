-- CreateEnum
CREATE TYPE "FeedPostKind" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FeedAudience" AS ENUM ('EVERYONE', 'TEAM', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "FeedReactionType" AS ENUM ('LIKE', 'LOVE', 'CELEBRATE', 'CLAP');

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT,
    "kind" "FeedPostKind" NOT NULL DEFAULT 'USER',
    "systemEventType" TEXT,
    "systemEventData" JSONB,
    "systemEntityType" TEXT,
    "systemEntityId" TEXT,
    "sourceAuditLogId" TEXT,
    "audience" "FeedAudience" NOT NULL DEFAULT 'EVERYONE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPostAudienceUser" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FeedPostAudienceUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FeedReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedMention" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedPost_sourceAuditLogId_key" ON "FeedPost"("sourceAuditLogId");

-- CreateIndex
CREATE INDEX "FeedPost_createdAt_idx" ON "FeedPost"("createdAt");

-- CreateIndex
CREATE INDEX "FeedPost_kind_idx" ON "FeedPost"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "FeedPostAudienceUser_postId_userId_key" ON "FeedPostAudienceUser"("postId", "userId");

-- CreateIndex
CREATE INDEX "FeedComment_postId_idx" ON "FeedComment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedReaction_postId_userId_key" ON "FeedReaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "FeedMention_mentionedUserId_idx" ON "FeedMention"("mentionedUserId");

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPostAudienceUser" ADD CONSTRAINT "FeedPostAudienceUser_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPostAudienceUser" ADD CONSTRAINT "FeedPostAudienceUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "FeedComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedAttachment" ADD CONSTRAINT "FeedAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedMention" ADD CONSTRAINT "FeedMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedMention" ADD CONSTRAINT "FeedMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "FeedComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedMention" ADD CONSTRAINT "FeedMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
