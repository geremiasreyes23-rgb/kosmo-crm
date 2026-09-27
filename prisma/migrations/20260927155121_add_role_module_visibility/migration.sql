-- CreateTable
CREATE TABLE "NotificationSetting" (
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdValue" INTEGER,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("type")
);
