-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_relatedEntityType_relatedEntityId_idx" ON "Notification"("userId", "type", "relatedEntityType", "relatedEntityId");
